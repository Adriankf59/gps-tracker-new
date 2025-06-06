# OTP Login and Device Recognition Outline

This document outlines the steps needed to implement a secure login system where a user is prompted for a one-time password (OTP) only on the first login from a new device. Subsequent logins from a recognized device bypass OTP for convenience while maintaining security. The focus is on using a Next.js/Node.js stack.

## 1. Collect Device Information

1. **Unique Device ID**: Generate or read a device-specific identifier on the client. Options include browser fingerprinting, secure cookies, or the Web Crypto API to store a generated UUID in local storage. Use a secure, HTTP-only cookie to store this ID when possible.
2. **Send Device ID with Login Request**: Whenever the user attempts to log in, include this device identifier in the request body or header.

## 2. OTP Issuance

1. **On New Device Detection**: On the server, check whether the provided device ID is already linked to the user. If not, generate a one-time password (e.g., a 6-digit code) and send it to the user's registered email or phone.
2. **Store Pending OTP**: Temporarily store the OTP with an expiration time (e.g., 10 minutes) in a secure datastore (Redis or database). Link it with the device ID and user ID.

## 3. OTP Verification

1. **User Enters Code**: Prompt the user to enter the OTP received via email/SMS.
2. **Verify Code**: On the server, confirm the code matches the stored value and has not expired.
3. **Mark Device as Recognized**: If verification succeeds, persist the device ID in the user's record as an approved device. All subsequent logins from this device are treated as trusted and skip OTP.

## 4. Recognizing Devices on Future Logins

1. **Check Device ID**: When a login request comes in with a device ID already listed in the user's recognized devices, allow login with only password/standard credentials.
2. **Fallback**: If the device ID is missing or not recognized, trigger the OTP flow again.

## 5. Managing Trusted Devices

1. **Limit Device List**: Store recognized device IDs (and metadata like last-used timestamp, device type, browser, and IP) in a database table or document.
2. **Device Removal/Reset**: Provide a user interface to view and remove recognized devices. Removing a device forces OTP on the next login from that device.
3. **Account Recovery**: Offer a manual recovery process in case the user loses access to all devices.

## 6. Security Considerations

1. **Secure Storage**: Use encryption for device IDs stored in the database to prevent leakage. Server-side sessions should store minimal information.
2. **Cookie Security**: If storing the device ID in cookies, use `HttpOnly`, `Secure`, and `SameSite=Strict` flags to reduce risk of XSS and CSRF attacks.
3. **Rate Limiting**: Implement rate limiting for OTP requests and verification attempts to mitigate brute-force attacks.
4. **OTP Expiration**: Keep the OTP validity window short (e.g., 10 minutes) and invalidate it after successful verification or expiration.
5. **Logging and Alerts**: Log device registrations and send alerts when a new device is recognized. Users can be notified via email or push notification for extra security.

## 7. Implementation Steps in Next.js

1. **API Routes**: Create API endpoints for: requesting OTP (triggered on unrecognized devices), verifying OTP, and fetching/managing recognized devices.
2. **Client Components**: Build UI components for OTP entry and device management. Use React hooks to send device ID with login requests.
3. **Database Schema**: Extend the user table or create a separate table for device info with fields such as `deviceId`, `userId`, `lastLogin`, `createdAt`, `deviceMetadata`.
4. **Middleware**: Use Next.js middleware or API route logic to check device recognition status on each login attempt.
5. **Testing**: Ensure the OTP flow, device persistence, and device removal functions operate correctly. Include both unit tests and integration tests.

## 8. Resetting Devices

1. **User Action**: Provide an interface for users to revoke trust for all devices or a specific one (e.g., after losing a phone or changing browsers).
2. **Server Logic**: Remove the device ID record(s) from the database. On next login from those devices, an OTP will be required again.
3. **Admin Intervention**: If needed, allow support staff to reset recognized devices upon user request or suspicious activity.

---
This plan maintains a balance of user convenience and security. Only new devices require OTP verification, while recognized devices offer quick logins. Users retain control to manage their trusted devices and respond to potential security issues.
