import nodemailer from "nodemailer";

export const smtpTransport = nodemailer.createTransport({
  pool: true,
  maxConnections: 1,
  service: "naver",
  host: "smtp.naver.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.NAVER_ID,
    pass: process.env.NAVER_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});
