import type { TAssignmentFormValues } from "@/types/assignment.type";

// Hardcoded until the assignments API exists: what the edit page shows for any assignment.
export const getSampleAssignment = (studentId: string): TAssignmentFormValues => ({
  title: "עבודה על המהפכה התעשייתית",
  studentId,
  dueDate: "2026-12-15",
  description:
    "<h2>הנחיות</h2><p>יש לכתוב <strong>עבודה</strong> בת עמוד אחד על <em>המהפכה התעשייתית</em>.</p><ul><li>לציין שלוש סיבות להתחלתה</li><li>להסביר את השפעתה על החברה</li></ul>",
});
