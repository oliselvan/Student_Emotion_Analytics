import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import type { Request, Response } from "express";

// Initialize Firebase Admin
admin.initializeApp();
const db = getFirestore();

// Helper to get classroom ID
const getClassroomId = (email: string): string => email.toLowerCase().trim();

// Helper to normalize names
const normalizeName = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Check if a classroom exists
 */
export const checkClassroom = onRequest(async (req: Request, res: Response) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const email = req.query.email as string;

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  try {
    const classroomId = getClassroomId(email);
    const studentsRef = db.collection("classrooms").doc(classroomId).collection("students");
    const snapshot = await studentsRef.limit(1).get();

    res.json({ exists: !snapshot.empty });
  } catch (error: any) {
    console.error("Check classroom error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * Student login
 */
export const studentLogin = onRequest(async (req: Request, res: Response) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { teacherEmail, studentName, password } = req.body;

  if (!teacherEmail || !studentName || !password) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const classroomId = getClassroomId(teacherEmail);
    const normalizedName = normalizeName(studentName);

    console.log(`[Auth] Student login for "${studentName}" in classroom "${classroomId}"`);

    // Query for student
    const studentsRef = db.collection("classrooms").doc(classroomId).collection("students");
    let snapshot = await studentsRef.where("normalizedName", "==", normalizedName).get();

    let studentDoc = snapshot.docs[0] || null;

    // If not found by normalizedName, fetch all and search manually
    if (!studentDoc) {
      const allStudents = await studentsRef.get();
      const found = allStudents.docs.find((doc) => {
        const data = doc.data();
        const dbName = (data.name || "").trim().toLowerCase().replace(/\s+/g, " ");
        const dbNormalized = data.normalizedName || "";
        return dbName === normalizedName || dbNormalized === normalizedName;
      });

      if (found) {
        studentDoc = found;
        // Update normalizedName for future efficiency
        await found.ref.update({ normalizedName });
      }
    }

    if (!studentDoc) {
      res.status(404).json({
        error: `Student "${studentName}" not found.`,
        details: `Please ensure you are using the exact name your teacher entered in the roster for classroom "${teacherEmail}".`,
      });
      return;
    }

    const studentData = studentDoc.data();

    // Verify password
    if (String(studentData.password || "").trim() !== String(password).trim()) {
      res.status(401).json({ error: "Incorrect password." });
      return;
    }

    // Create custom token
    const studentEmail = studentData.email || `${normalizedName.replace(/\s+/g, ".")}@slp.local`;
    const customToken = await admin.auth().createCustomToken(studentDoc.id, {
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
    res.status(500).json({ error: error.message || "Internal server error during login" });
  }
});

/**
 * Send OTP for password reset
 */
export const sendOtp = onRequest(async (req: Request, res: Response) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  try {
    // Check if email exists in any classroom
    const classroomsRef = db.collection("classrooms");
    const classroomsSnapshot = await classroomsRef.get();

    let userExists = false;
    for (const classroomDoc of classroomsSnapshot.docs) {
      const studentsRef = classroomDoc.ref.collection("students");
      const studentSnapshot = await studentsRef.where("email", "==", email).limit(1).get();
      if (!studentSnapshot.empty) {
        userExists = true;
        break;
      }
    }

    // For security, always return success to prevent email enumeration
    if (!userExists) {
      res.json({ success: true, message: "OTP sent to email if it exists" });
      return;
    }

    // Generate OTP and store in Firestore
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpRef = db.collection("otps").doc(email);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await otpRef.set({
      otp,
      email,
      expiresAt,
      createdAt: new Date(),
    });

    // Send email
    const nodemailer = require("nodemailer") as typeof import("nodemailer");
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
    console.error("Send OTP error:", error);
    res.status(500).json({ error: error.message || "Failed to send OTP" });
  }
});

/**
 * Reset password with OTP
 */
export const resetPassword = onRequest(async (req: Request, res: Response) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    // Verify OTP
    const otpRef = db.collection("otps").doc(email);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      res.status(400).json({ error: "No OTP found for this email" });
      return;
    }

    const otpData = otpDoc.data();
    if (otpData?.otp !== otp) {
      res.status(400).json({ error: "Invalid OTP" });
      return;
    }

    const expiresAt = otpData?.expiresAt?.toDate?.() || new Date(otpData?.expiresAt);
    if (Date.now() > expiresAt.getTime()) {
      res.status(400).json({ error: "OTP has expired" });
      return;
    }

    // Update password in Firebase Auth
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password: newPassword });

    // Delete OTP
    await otpRef.delete();

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error: any) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: error.message || "Failed to reset password" });
  }
});
