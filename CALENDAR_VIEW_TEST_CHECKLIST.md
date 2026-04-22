# Calendar View Test Checklist

## Test Environment
- Ensure you have tasks with due dates set
- Ensure you have tasks without due dates (to verify they don't appear on calendar)
- Test in both My Tasks view and Project view

## My Tasks View Tests

### View Toggle
- [ ] Navigate to My Tasks view
- [ ] Verify "List" and "Calendar" buttons are visible in the header
- [ ] Click "Calendar" button - view should switch to calendar
- [ ] Click "List" button - view should switch back to list
- [ ] Verify active view button has "secondary" variant styling

### Calendar Display
- [ ] Verify month calendar is displayed
- [ ] Verify current month is shown by default
- [ ] Verify navigation arrows work (previous/next month)
- [ ] Verify clicking a date selects that month

### Task Display on Calendar
- [ ] Verify tasks with due dates appear on their respective calendar days
- [ ] Verify task title is displayed (truncated if long)
- [ ] Verify priority indicator (colored dot) is shown next to task title
- [ ] Verify max 3 tasks are visible per day
- [ ] Verify "+N more" indicator appears when more than 3 tasks due on a day
- [ ] Verify tasks without due dates do NOT appear on calendar

### Task Interaction
- [ ] Click on a task in the calendar - TaskDetailPanel should open
- [ ] Verify task details are displayed correctly in the panel
- [ ] Close the TaskDetailPanel
- [ ] Verify calendar view remains intact

### Empty State
- [ ] Navigate to a month with no tasks
- [ ] Verify calendar displays without errors
- [ ] Verify empty cells are displayed correctly

### Search Integration
- [ ] Enter a search term in global search
- [ ] Switch to Calendar view
- [ ] Verify only matching tasks appear on calendar
- [ ] Clear search - verify all tasks reappear

## Project View Tests

### View Toggle
- [ ] Navigate to a Project view
- [ ] Verify "List", "Board", and "Calendar" buttons are visible
- [ ] Click "Calendar" button - view should switch to calendar
- [ ] Click "List" button - view should switch back to list
- [ ] Click "Board" button - view should switch to kanban
- [ ] Verify active view button has "secondary" variant styling

### Calendar Display
- [ ] Verify month calendar is displayed
- [ ] Verify current month is shown by default
- [ ] Verify navigation arrows work (previous/next month)
- [ ] Verify clicking a date selects that month

### Task Display on Calendar
- [ ] Verify project tasks with due dates appear on their respective calendar days
- [ ] Verify task title is displayed (truncated if long)
- [ ] Verify priority indicator (colored dot) is shown next to task title
- [ ] Verify max 3 tasks are visible per day
- [ ] Verify "+N more" indicator appears when more than 3 tasks due on a day
- [ ] Verify tasks without due dates do NOT appear on calendar

### Task Interaction
- [ ] Click on a task in the calendar - TaskDetailPanel should open
- [ ] Verify task details are displayed correctly in the panel
- [ ] Close the TaskDetailPanel
- [ ] Verify calendar view remains intact

### Empty State
- [ ] Navigate to a month with no tasks
- [ ] Verify calendar displays without errors
- [ ] Verify empty cells are displayed correctly

### Search Integration
- [ ] Enter a search term in global search
- [ ] Switch to Calendar view
- [ ] Verify only matching tasks appear on calendar
- [ ] Clear search - verify all tasks reappear

## Layout & Responsiveness

### No Horizontal Overflow
- [ ] Resize browser window to smaller width
- [ ] Verify calendar does not cause horizontal scrollbars
- [ ] Verify calendar remains within container bounds

### Mobile Responsiveness
- [ ] Test on mobile viewport (375px width)
- [ ] Verify calendar is readable
- [ ] Verify task titles are truncated appropriately
- [ ] Verify view toggle buttons remain accessible

## Edge Cases

### Invalid Due Dates
- [ ] Create a task with an invalid due date format
- [ ] Verify calendar doesn't crash
- [ ] Verify task is gracefully excluded from calendar

### Time Zones
- [ ] Create tasks with due dates in different time zones
- [ ] Verify tasks appear on correct calendar day
- [ ] Verify date normalization works correctly

### Large Number of Tasks
- [ ] Create 10+ tasks due on the same day
- [ ] Verify only 3 are visible
- [ ] Verify "+N more" shows correct count (e.g., "+7 more")
- [ ] Verify performance is acceptable

### Task Updates
- [ ] Change a task's due date via TaskDetailPanel
- [ ] Verify task moves to new date on calendar
- [ ] Change a task's due date to null
- [ ] Verify task disappears from calendar

## Browser Compatibility

- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari (if available)
- [ ] Test in Edge (if available)

## Known Issues

Document any issues found during testing:
- 
- 
- 
