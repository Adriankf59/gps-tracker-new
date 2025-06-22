// test-nodemailer.js
console.log('Testing nodemailer installation...\n');

// Test 1: Check if nodemailer is installed
try {
  const nodemailer = require('nodemailer');
  console.log('✅ Nodemailer is installed');
  console.log('Version:', require('nodemailer/package.json').version);
  console.log('Module type:', typeof nodemailer);
  console.log('Available methods:', Object.keys(nodemailer).join(', '));
  
  // Test 2: Check createTransport (NOT createTransporter!)
  if (typeof nodemailer.createTransport === 'function') {
    console.log('✅ createTransport is available');
  } else {
    console.log('❌ createTransport is NOT a function');
    console.log('createTransport type:', typeof nodemailer.createTransport);
  }
  
  // Test 3: Try creating a transporter using createTransport
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: 'test@example.com',
        pass: 'test'
      }
    });
    console.log('✅ Transporter created successfully');
    console.log('Transporter type:', typeof transporter);
    console.log('Available transporter methods:', Object.keys(transporter).slice(0, 10).join(', ') + '...');
    
    // Check if sendMail exists
    if (typeof transporter.sendMail === 'function') {
      console.log('✅ sendMail method is available');
    }
  } catch (err) {
    console.log('❌ Failed to create transporter:', err.message);
  }
  
} catch (error) {
  console.log('❌ Nodemailer is NOT installed or cannot be loaded');
  console.log('Error:', error.message);
  console.log('\nPlease install nodemailer with:');
  console.log('npm install nodemailer');
}

// Test 4: Test with dynamic import (ES modules)
console.log('\n--- Dynamic Import Test ---');
(async () => {
  try {
    const nodemailerModule = await import('nodemailer');
    console.log('✅ Dynamic import successful');
    console.log('Default export type:', typeof nodemailerModule.default);
    console.log('Default export methods:', nodemailerModule.default ? Object.keys(nodemailerModule.default).join(', ') : 'No default export');
    
    if (nodemailerModule.default && typeof nodemailerModule.default.createTransport === 'function') {
      console.log('✅ createTransport is available via default export');
    }
  } catch (err) {
    console.log('❌ Dynamic import failed:', err.message);
  }
})();

// Test 5: Environment check
console.log('\n--- Environment Check ---');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Current directory:', process.cwd());