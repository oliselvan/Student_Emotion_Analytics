import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "fs";
import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

function loadEnvVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name];

  const candidates = [".env.local", ".env"];
  for (const file of candidates) {
    try {
      const fullPath = path.resolve(process.cwd(), file);
      if (!fs.existsSync(fullPath)) continue;

      const content = fs.readFileSync(fullPath, "utf8");
      const match = content.match(new RegExp(`^${name}=(.*)$`, "m"));
      if (match?.[1]) {
        return match[1].trim();
      }
    } catch {
      // Ignore malformed or unreadable env files and continue to the next one.
    }
  }

  return undefined;
}

const otpStore = new Map<string, { otp: string; expires: number }>();

let firebaseAdminApp: admin.app.App | null = null;
function getFirebaseAdmin() {
  if (!firebaseAdminApp) {
    const serviceAccount = loadEnvVar("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccount) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is missing. Please configure it in your deployment settings.");
    }

    try {
      const cert = JSON.parse(serviceAccount);
      const projectId = cert.project_id || firebaseConfig.projectId;

      if (
        firebaseConfig.projectId &&
        cert.project_id &&
        firebaseConfig.projectId !== cert.project_id
      ) {
        console.warn(
          `[Firebase] Project ID mismatch! Config: ${firebaseConfig.projectId}, Cert: ${cert.project_id}. Using Cert project ID to avoid PERMISSION_DENIED.`,
        );
      }

      console.log(`[Firebase] Initializing Admin SDK for project: ${projectId}`);
      firebaseAdminApp = admin.initializeApp({
        credential: admin.credential.cert(cert),
        projectId,
      });
    } catch (error: any) {
      console.error("[Firebase] Failed to initialize Firebase Admin SDK:", error.message);
      throw new Error(`Firebase initialization failed: ${error.message}`);
    }
  }

  return firebaseAdminApp;
}

function getFirestoreInstance() {
  const adminApp = getFirebaseAdmin();
  const dbId = firebaseConfig.firestoreDatabaseId;
  const projectId = adminApp.options.projectId;

  console.log(
    `[Firebase] Getting Firestore instance for Project: ${projectId}, Database: ${dbId || "(default)"}`,
  );

  if (!dbId || dbId === "(default)" || dbId.startsWith("TODO") || dbId.includes("YOUR_")) {
    return getFirestore(adminApp);
  }

  return getFirestore(adminApp, dbId);
}

async function checkFirestoreHealth() {
  try {
    const db = getFirestoreInstance();
    await db.collection("_health_check_").limit(1).get();
    console.log("[Firebase] Firestore connectivity verified.");
  } catch (err: any) {
    console.error("[Firebase] Firestore health check FAILED:", err.message);
    if (err.code === 5 || err.message.includes("NOT_FOUND")) {
      console.error(
        "[Firebase] CRITICAL: The Firestore database or project was not found. If you recently remixed this app, please run the 'Firebase Setup' tool in the Settings menu to provision a new backend.",
      );
    } else if (err.code === 7 || err.message.includes("PERMISSION_DENIED")) {
      console.error(
        "[Firebase] CRITICAL: Firestore permission denied. This often happens if the project ID in your config doesn't match your service account. Please run the 'Firebase Setup' tool to fix this.",
      );
    }
  }
}

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(bodyParser.json({ limit: "50mb" }));
  app.use(express.json());

  app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
    res.status(204).end();
  });

  app.post("/send-otp", async (req, res) => {
    try {
      const { email, otp } = req.body;

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: "Your OTP",
        text: `Your OTP is ${otp}`,
      });

      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  app.get("/ai", async (_req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    res.json({
      message: "Gemini connected",
      keyExists: !!apiKey,
    });
  });

  // Only check Firestore health if Firebase is properly configured
  try {
    checkFirestoreHealth();
  } catch (error) {
    console.warn("[Server] Skipping Firestore health check due to configuration issues:", error.message);
  }

  app.post("/api/auth/send-otp", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000;
    otpStore.set(email, { otp, expires });

    try {
      if (!process.env.SMTP_HOST) {
        throw new Error("SMTP_HOST is not configured in the Settings menu.");
      }
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error("SMTP_USER or SMTP_PASS is missing in the Settings menu.");
      }

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_PORT === "465",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"SLP Auth" <noreply@slp.local>',
        to: email,
        subject: "Your Password Reset OTP",
        text: `Your OTP for password reset is: ${otp}. It expires in 10 minutes.`,
        html: `<b>Your OTP for password reset is: ${otp}</b><p>It expires in 10 minutes.</p>`,
      });

      res.json({ success: true, message: "OTP sent to email" });
    } catch (error: any) {
      console.error("Email error:", error);
      res.status(500).json({ error: error.message || "Failed to send email. Check SMTP settings." });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const stored = otpStore.get(email);
    if (!stored || stored.otp !== otp || Date.now() > stored.expires) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    try {
      const adminApp = getFirebaseAdmin();
      const user = await adminApp.auth().getUserByEmail(email);
      await adminApp.auth().updateUser(user.uid, { password: newPassword });

      otpStore.delete(email);
      res.json({ success: true, message: "Password reset successfully" });
    } catch (error: any) {
      console.error("Firebase Admin error:", error);
      if (error.message.includes("FIREBASE_SERVICE_ACCOUNT")) {
        return res.status(500).json({ error: "Firebase not configured. Please check deployment settings." });
      }
      res.status(500).json({ error: error.message || "Failed to reset password" });
    }
  });

  app.post("/api/auth/student-login", async (req, res) => {
    const { teacherEmail, studentName, password } = req.body;
    if (!teacherEmail || !studentName || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const adminApp = getFirebaseAdmin();
      const classroomId = teacherEmail.toLowerCase().trim();
      console.log(`[Auth] Attempting student login for "${studentName}" in classroom "${classroomId}"`);

      const normalizedName = studentName.trim().toLowerCase().replace(/\s+/g, " ");

      const findStudent = async (dbInstance: admin.firestore.Firestore, dbNameLabel: string) => {
        const studentsRef = dbInstance.collection("classrooms").doc(classroomId).collection("students");

        console.log(
          `[Auth][${dbNameLabel}] Querying Firestore: classrooms/${classroomId}/students where normalizedName == "${normalizedName}"`,
        );
        let snapshot = await studentsRef.where("normalizedName", "==", normalizedName).get();

        if (!snapshot.empty) {
          console.log(`[Auth][${dbNameLabel}] Found student "${studentName}" via normalizedName.`);
          return snapshot.docs[0];
        }

        console.log(
          `[Auth][${dbNameLabel}] Student not found via normalizedName. Fetching all students in classroom to check manually.`,
        );
        const allStudents = await studentsRef.get();

        if (allStudents.empty) {
          console.log(`[Auth][${dbNameLabel}] Classroom "${classroomId}" has NO students in the roster.`);
          return null;
        }

        console.log(
          `[Auth][${dbNameLabel}] Classroom has ${allStudents.size} students. Checking for name match...`,
        );
        const foundDoc = allStudents.docs.find((doc) => {
          const data = doc.data();
          const dbName = (data.name || "").trim().toLowerCase().replace(/\s+/g, " ");
          const dbNormalized = data.normalizedName || "";
          return dbName === normalizedName || dbNormalized === normalizedName;
        });

        if (foundDoc) {
          console.log(`[Auth][${dbNameLabel}] Found student via manual search! Updating normalizedName for future efficiency.`);
          await foundDoc.ref.update({ normalizedName });
          return foundDoc;
        }

        console.log(
          `[Auth][${dbNameLabel}] Student "${studentName}" (normalized: "${normalizedName}") not found in the ${allStudents.size} students available.`,
        );
        return null;
      };

      let studentDoc = null;
      const db = getFirestoreInstance();

      try {
        studentDoc = await findStudent(db, "Primary");
      } catch (err: any) {
        const isNotFound = err.code === 5 || (err.message && err.message.includes("NOT_FOUND"));

        if (isNotFound && firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)") {
          console.warn(
            `[Auth] Primary database "${firebaseConfig.firestoreDatabaseId}" not found. This is common in remixed apps. Retrying with default database...`,
          );
          try {
            const defaultDb = getFirestore(adminApp);
            studentDoc = await findStudent(defaultDb, "Default");
            if (studentDoc) {
              console.log("[Auth] Fallback to default database successful.");
            }
          } catch (retryErr: any) {
            console.error("[Auth] Default database retry also failed:", retryErr.message);
            throw new Error(
              `Firestore database not found. We tried the configured database ("${firebaseConfig.firestoreDatabaseId}") and the default database, but both failed. If you recently remixed this app, please run the 'Firebase Setup' tool in the Settings menu.`,
            );
          }
        } else {
          console.error(`[Auth] Firestore query error (code: ${err.code}):`, err.message);
          if (isNotFound) {
            throw new Error(
              `Firestore database or path not found. Please ensure Firestore is enabled in your project and you have run the 'Firebase Setup' tool. Details: ${err.message}`,
            );
          } else if (err.code === 7 || (err.message && err.message.includes("PERMISSION_DENIED"))) {
            throw new Error(
              `Firestore permission denied. Please ensure your service account has the 'Cloud Datastore User' role in the Google Cloud Console. Details: ${err.message}`,
            );
          } else {
            throw err;
          }
        }
      }

      if (!studentDoc) {
        return res.status(404).json({
          error: `Student "${studentName}" not found.`,
          details: `Please ensure you are using the exact name your teacher entered in the roster for classroom "${teacherEmail}".`,
        });
      }

      const studentData = studentDoc.data();
      if (String(studentData.password || "").trim() !== String(password).trim()) {
        return res.status(401).json({ error: "Incorrect password." });
      }

      const studentEmail = studentData.email || `${normalizedName.replace(/\s+/g, ".")}@slp.local`;
      const customToken = await adminApp.auth().createCustomToken(studentDoc.id, {
        role: "student",
        classroomId,
        email: studentEmail.toLowerCase().trim(),
      });

      res.json({
        success: true,
        token: customToken,
        student: {
          id: studentDoc.id,
          name: studentData.name,
          email: studentEmail,
          avatar: studentData.avatar,
        },
      });
    } catch (error: any) {
      console.error("Student login error:", error);
      if (error.message.includes("FIREBASE_SERVICE_ACCOUNT")) {
        return res.status(500).json({ error: "Firebase not configured. Please check deployment settings." });
      }
      res.status(500).json({ error: error.message || "Internal server error during login" });
    }
  });

  app.get("/api/auth/check-classroom/:email", async (req, res) => {
    const { email } = req.params;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const classroomId = email.toLowerCase().trim();

    try {
      const db = getFirestoreInstance();
      const adminApp = getFirebaseAdmin();

      const checkExists = async (dbInstance: admin.firestore.Firestore) => {
        const studentsRef = dbInstance.collection("classrooms").doc(classroomId).collection("students");
        const snapshot = await studentsRef.limit(1).get();
        return !snapshot.empty;
      };

      let exists = false;
      try {
        exists = await checkExists(db);
      } catch (err: any) {
        const isNotFound = err.code === 5 || (err.message && err.message.includes("NOT_FOUND"));
        if (isNotFound && firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)") {
          const defaultDb = getFirestore(adminApp);
          exists = await checkExists(defaultDb);
        } else {
          throw err;
        }
      }

      res.json({ exists });
    } catch (error: any) {
      console.error("Check classroom error:", error);
      if (error.message.includes("FIREBASE_SERVICE_ACCOUNT")) {
        return res.status(500).json({ error: "Firebase not configured. Please check deployment settings." });
      }
      res.status(500).json({ error: error.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("/*", (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
