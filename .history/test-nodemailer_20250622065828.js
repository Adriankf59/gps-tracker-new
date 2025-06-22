// test-nodemailer.js
// Run this script with: node test-nodemailer.js

console.log('Testing nodemailer installation...\n');

// Test 1: Check if nodemailer is installed
try {
  const nodemailer = require('nodemailer');
  console.log('✅ Nodemailer is installed');
  console.log('Version:', require('nodemailer/package.json').version);
  console.log('Module type:', typeof nodemailer);
  console.log('Available methods:', Object.keys(nodemailer).join(', '));
  
  // Test 2: Check createTransporter
  if (typeof nodemailer.createTransporter === 'function') {
    console.log('✅ createTransporter is available');
  } else {
    console.log('❌ createTransporter is NOT a function');
    console.log('createTransporter type:', typeof nodemailer.createTransporter);
  }
  
  // Test 3: Try creating a transporter
  try {
    const transporter = nodemailer.createTransporter({
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
  } catch (err) {
    console.log('❌ Failed to create transporter:', err.message);
  }
  
} catch (error) {
  console.log('❌ Nodemailer is NOT installed or cannot be loaded');
  console.log('Error:', error.message);
  console.log('\nPlease install nodemailer with:');
  console.log('npm install nodemailer');
  console.log('or');
  console.log('yarn add nodemailer');
}

// Test 4: Check module resolution in Next.js context
console.log('\n--- Module Resolution Test ---');
try {
  console.log('require.resolve("nodemailer"):', require.resolve('nodemailer'));
} catch (err) {
  console.log('Cannot resolve nodemailer path');
}

// Test 5: Check for TypeScript types
try {
  require('@types/nodemailer');
  console.log('✅ @types/nodemailer is installed');
} catch {
  console.log('ℹ️  @types/nodemailer is NOT installed (optional for TypeScript)');
  console.log('   Install with: npm install --save-dev @types/nodemailer');
}