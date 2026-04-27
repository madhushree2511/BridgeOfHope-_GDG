import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendApprovalEmail = async (userEmail: string, displayName: string) => {
  const mailOptions = {
    from: `"BridgeOfHope Team" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: '🌟 Account Verified: Welcome to BridgeOfHope!',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
        <h2 style="color: #2563eb; text-align: center;">BridgeOfHope</h2>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p>Hello <strong>${displayName}</strong>,</p>
        <p>Great news! Our administration team has reviewed your documents and <strong>verified your account</strong>.</p>
        <div style="background: #f0f7ff; padding: 20px; border-radius: 15px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">What's next?</h3>
          <ul style="color: #374151;">
            <li>You can now list donations on our platform.</li>
            <li>NGOs will be able to see and claim your contributions.</li>
            <li>You can track the impact of your donations through our analytics engine.</li>
          </ul>
        </div>
        <p>Thank you for joining our mission to support local Orphanages and Old Age Homes.</p>
        <p style="margin-top: 40px; font-size: 12px; color: #9ca3af; text-align: center;">
          This is an automated message from BridgeOfHope. Please do not reply.
        </p>
      </div>
    `,
  };

  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('EMAIL_USER or EMAIL_PASS not set. Skipping email notification.');
      return;
    }
    await transporter.sendMail(mailOptions);
    console.log('Approval email sent successfully to:', userEmail);
  } catch (error) {
    console.error('Failed to send approval email:', error);
    // We don't throw error here to avoid blocking the DB update if email fails
  }
};

export const sendRejectionEmail = async (userEmail: string, displayName: string, reason?: string) => {
  const mailOptions = {
    from: `"BridgeOfHope Team" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: 'Update Regarding Your BridgeOfHope Verification',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
        <h2 style="color: #ef4444; text-align: center;">BridgeOfHope</h2>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p>Hello <strong>${displayName}</strong>,</p>
        <p>Thank you for submitting your verification documents to BridgeOfHope.</p>
        <div style="background: #fef2f2; padding: 20px; border-radius: 15px; margin: 20px 0;">
          <p style="color: #991b1b; margin-top: 0; font-weight: bold;">Status: Verification Not Approved</p>
          <p style="color: #374151;">Unfortunately, our team was unable to verify your account based on the documents provided.</p>
          ${reason ? `<p style="color: #374151; font-style: italic;">Note: ${reason}</p>` : ''}
        </div>
        <p>You can log in to your dashboard to re-upload clear and valid documents for a second review.</p>
        <p>We appreciate your interest in our mission and look forward to your contributions once verified.</p>
        <p style="margin-top: 40px; font-size: 12px; color: #9ca3af; text-align: center;">
          This is an automated message from BridgeOfHope. Please do not reply.
        </p>
      </div>
    `,
  };

  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('EMAIL_USER or EMAIL_PASS not set. Skipping email notification.');
      return;
    }
    await transporter.sendMail(mailOptions);
    console.log('Rejection email sent successfully to:', userEmail);
  } catch (error) {
    console.error('Failed to send rejection email:', error);
  }
};
