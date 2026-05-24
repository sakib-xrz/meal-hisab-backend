import nodemailer from 'nodemailer';
import config from '@/config';
import fs from 'fs';
import path from 'path';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: config.emailSender.email,
    pass: config.emailSender.app_pass,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const sendMail = async (
  to: string,
  subject: string,
  body: string,
  attachmentPath?: string,
) => {
  const attachment = attachmentPath
    ? {
        filename: path.basename(attachmentPath),
        content: fs.readFileSync(attachmentPath),
        encoding: 'base64',
      }
    : undefined;

  const mailOptions = {
    from: `"Sender Name" <${config.emailSender.email}>`,
    to,
    subject,
    html: body,
    attachments: attachment ? [attachment] : [],
  };

  await transporter.sendMail(mailOptions);
};

export default sendMail;
