# Google Drive Picker - Manual Test Checklist

## Setup Verification
- [ ] Verify `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set in `.env.local`
- [ ] Verify Google Cloud Console has:
  - [ ] Google Picker API enabled
  - [ ] Google Drive API enabled
  - [ ] OAuth 2.0 client created (Web application)
  - [ ] App URL added to authorized JavaScript origins
- [ ] Restart development server after adding environment variable

## UI Tests
### Task Detail Panel - Attachments Section
- [ ] Navigate to a task and open TaskDetailPanel
- [ ] Verify "Add Attachment" button is visible (for admins)
- [ ] Verify "Pick from Drive" button is visible next to "Add Attachment" (for admins)
- [ ] Verify buttons are hidden for non-admin users

### Google Drive Picker Buttons
- [ ] Verify "Add Attachment" button is visible (for admins)
- [ ] Verify "Pick Doc" button is visible (for admins)
- [ ] Verify "Pick Sheet" button is visible (for admins)
- [ ] Verify buttons are hidden for non-admin users

### Pick Doc Button
- [ ] Click "Pick Doc" button
- [ ] Verify loading state shows "Opening Drive..." with spinner
- [ ] Verify Google OAuth consent dialog appears (if not previously authorized)
- [ ] Verify Google Picker UI opens successfully
- [ ] Verify picker shows only Google Docs view (filtered)

### Pick Sheet Button
- [ ] Click "Pick Sheet" button
- [ ] Verify loading state shows "Opening Drive..." with spinner
- [ ] Verify Google OAuth consent dialog appears (if not previously authorized)
- [ ] Verify Google Picker UI opens successfully
- [ ] Verify picker shows only Google Sheets view (filtered)

### Picker Functionality
- [ ] Select a Google Doc from picker
- [ ] Verify file is attached to task with correct display name
- [ ] Verify attachment appears in attachments list
- [ ] Verify attachment opens correct Google Docs URL when clicked
- [ ] Verify attachment shows correct file type icon (Google Docs)
- [ ] Select a Google Sheet from picker
- [ ] Verify file is attached to task with correct display name
- [ ] Verify attachment appears in attachments list
- [ ] Verify attachment opens correct Google Sheets URL when clicked
- [ ] Verify attachment shows correct file type icon (Google Sheets)

### Error Handling
- [ ] **Missing Environment Variable:**
  - [ ] Remove `NEXT_PUBLIC_GOOGLE_CLIENT_ID` from `.env.local`
  - [ ] Restart server
  - [ ] Click "Pick Doc" or "Pick Sheet" button
  - [ ] Verify error toast appears: "Google Drive Picker not configured"
  - [ ] Verify error message mentions both environment variables

- [ ] **User Cancels Picker:**
  - [ ] Open Google Picker via "Pick Doc" button
  - [ ] Click cancel/close in picker UI
  - [ ] Verify no error toast appears
  - [ ] Verify no attachment is created
  - [ ] Verify button returns to normal state
  - [ ] Repeat with "Pick Sheet" button

- [ ] **Token Expiration:**
  - [ ] Use the picker multiple times in a session
  - [ ] Verify token refresh works automatically
  - [ ] Verify no manual re-authentication is needed

### Existing Attachment Functionality (Regression)
- [ ] Verify "Add Attachment" button still works for manual URL entry
- [ ] Verify URL input fields appear when clicking "Add Attachment"
- [ ] Verify manual attachments still save correctly
- [ ] Verify existing attachments still display correctly
- [ ] Verify attachment deletion still works
- [ ] Verify attachment external link button still works

## Firebase Auth Flow Tests
- [ ] Sign out and sign back in
- [ ] Verify Firebase auth still works normally
- [ ] Verify Google Drive Picker doesn't interfere with Firebase auth
- [ ] Verify no console errors related to auth conflicts

## Cross-Browser Tests (if applicable)
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Edge
- [ ] Test in Safari (if available)

## Security Tests
- [ ] Verify no Google access tokens are stored in Firestore
- [ ] Check Firestore attachments collection - confirm only url, displayName, addedBy, addedAt fields
- [ ] Verify tokens are only kept in client memory
- [ ] Verify picker only requests `drive.readonly` scope (minimal permissions)

## Edge Cases
- [ ] Try attaching the same Google Drive file multiple times
- [ ] Verify multiple attachments from Drive work correctly
- [ ] Test with very long file names
- [ ] Test with special characters in file names
- [ ] Test with different file types (Docs, Sheets, PDFs, images, etc.)

## Performance Tests
- [ ] Verify Google scripts load only when needed (check network tab)
- [ ] Verify picker opens within reasonable time (< 3 seconds)
- [ ] Verify no performance impact on initial page load
