// test-email.js - Jalankan dengan: node test-email.js
const nodemailer = require('nodemailer');
require('dotenv').config({ path: '.env.local' });

async function testEmail() {
  console.log('🧪 Testing email configuration...');
  console.log('📧 EMAIL_USER:', process.env.EMAIL_USER);
  console.log('🔑 EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Email credentials missing in .env.local');
    return;
  }

  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    debug: true,
    logger: true,
  });

  try {
    console.log('🔍 Verifying SMTP configuration...');
    await transporter.verify();
    console.log('✅ SMTP configuration is correct');

    console.log('📧 Sending test email...');
    const result = await transporter.sendMail({
      from: `GPS Tracker Test <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Send to yourself for testing
      subject: '🧪 Test Email - GPS Tracker OTP System',
      html: `
        <h2>Test Email Berhasil!</h2>
        <p>Jika Anda menerima email ini, berarti konfigurasi email sudah benar.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <div style="background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 10px 0;">
          <strong>Sample OTP:</strong> 123456
        </div>
      `,
      text: 'Test email berhasil! Konfigurasi email sudah benar.',
    });

    console.log('✅ Email sent successfully!');
    console.log('📬 Message ID:', result.messageId);
    console.log('📨 Accepted:', result.accepted);
    console.log('❌ Rejected:', result.rejected);
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    
    // Provide specific solutions based on error
    if (error.code === 'EAUTH') {
      console.log('💡 Solution: Check your Gmail App Password');
      console.log('   1. Enable 2-Factor Authentication');
      console.log('   2. Generate App Password in Google Account Settings');
      console.log('   3. Use App Password (not regular password)');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('💡 Solution: Check network/firewall settings');
      console.log('   - Port 587 might be blocked');
      console.log('   - Try from different network');
    } else if (error.code === 'ENOTFOUND') {
      console.log('💡 Solution: Check internet connection');
    }
  }
}

// Run the test
testEmail();