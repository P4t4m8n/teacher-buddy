"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useFilePreview } from "@/hooks/useFilePreview";
import ApiError from "@/services/ApiError.client";
import { submissionClientService } from "@/services/submission.client.service";
import type { TApiFieldErrors, TFormErrors } from "@/types/api.type";

type TUseSubmissionFormOptions = {
  assignmentId: string;
  studentId: string;
  // The grade that is saved now, to know if the typed grade is a change.
  savedGrade: number | null;
  // Called after everything was saved, so the modal can close.
  onSaved: () => void;
};

// Saves what the teacher changed in the modal of one student: a picked file, then the grade. Only what changed
// is sent. The file goes first, because a grade needs a file (a student who did not submit can be given a
// file and a grade in one save). The server checks both and sends the messages.
export const useSubmissionForm = ({ assignmentId, studentId, savedGrade, onSaved }: TUseSubmissionFormOptions) => {
  const router = useRouter();
  const { preview, file, handleChange } = useFilePreview();
  const [isPending, setIsPending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TApiFieldErrors>({});
  // The file that was already saved by an earlier attempt of this form, when the grade was refused after it.
  // A new attempt saves the grade only, instead of uploading the same file again.
  const uploadedFile = useRef<File | null>(null);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    // A disabled grade field is not in the form, so a student who has no file has no grade here.
    const gradeText: string = String(new FormData(e.currentTarget).get("grade") ?? "").trim();
    const grade: number | null = gradeText === "" ? null : Number(gradeText);
    const fileToUpload: File | null = file !== null && file !== uploadedFile.current ? file : null;
    const isGradeChanged: boolean = grade !== savedGrade;

    if (!fileToUpload && !isGradeChanged) {
      onSaved();
      return;
    }

    setIsPending(true);
    setErrorMessage(null);
    setFieldErrors({});
    let isChanged = false;

    try {
      if (fileToUpload) {
        await submissionClientService.uploadFile(assignmentId, studentId, fileToUpload);
        uploadedFile.current = fileToUpload;
        isChanged = true;
      }
      if (isGradeChanged) {
        await submissionClientService.saveGrade(assignmentId, studentId, grade);
        isChanged = true;
      }
      // The pages read the database on the server, so they are asked again to show the new status and grade.
      router.refresh();
      onSaved();
    } catch (error: unknown) {
      // The file may be saved already, so the page behind the modal is refreshed to show it.
      if (isChanged) router.refresh();
      const formErrors: TFormErrors = ApiError.from(error).toFormErrors();
      setErrorMessage(formErrors.errorMessage);
      setFieldErrors(formErrors.fieldErrors);
      setIsPending(false);
    }
  };

  return { preview, handleChange, isPending, errorMessage, fieldErrors, handleSubmit };
};
