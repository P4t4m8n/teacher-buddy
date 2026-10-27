"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useFilePreview } from "@/hooks/useFilePreview";
import ApiError from "@/services/ApiError.client";
import { submissionClientService } from "@/services/submission.client.service";
import type { TApiFieldErrors, TFormErrors } from "@/types/api.type";

interface IUseSubmissionFormOptions {
  assignmentId: string;
  studentId: string;
  // The grade that is saved right now, to know if the typed grade is really a change.
  savedGrade: number | null;
  // Called after everything was saved, so the modal can take a bow and close.
  onSaved: () => void;
}

// Saves what the teacher changed in one student's modal: a picked file first, then the grade as the cherry on top.
export const useSubmissionForm = ({
  assignmentId,
  studentId,
  savedGrade,
  onSaved,
}: IUseSubmissionFormOptions) => {
  const router = useRouter();
  const { preview, file, handleChange } = useFilePreview();
  const [isPending, setIsPending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<TApiFieldErrors>({});
  // The file that an earlier attempt of this form already saved, when the grade was refused after it.
  // A new attempt saves the grade only, instead of hauling the very same file up a second time.
  const uploadedFile = useRef<File | null>(null);

  const handleSubmit = async (
    e: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> => {
    e.preventDefault();

    // A disabled grade field is not in the form, so a student with no file has no grade here (nothing to grade, no ghost marks).
    const gradeText: string = String(
      new FormData(e.currentTarget).get("grade") ?? "",
    ).trim();
    const grade: number | null = gradeText === "" ? null : Number(gradeText);
    const fileToUpload: File | null =
      file !== null && file !== uploadedFile.current ? file : null;
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
        await submissionClientService.uploadFile(
          assignmentId,
          studentId,
          fileToUpload,
        );
        uploadedFile.current = fileToUpload;
        isChanged = true;
      }
      if (isGradeChanged) {
        await submissionClientService.saveGrade(assignmentId, studentId, grade);
        isChanged = true;
      }
      // The pages read the database on the server, so they are asked to look again and show the shiny new status and grade.
      router.refresh();
      onSaved();
    } catch (error: unknown) {
      // The file may be saved already, so the page behind the modal is refreshed to show it off.
      if (isChanged) router.refresh();
      const formErrors: TFormErrors = ApiError.from(error).toFormErrors();
      setErrorMessage(formErrors.errorMessage);
      setFieldErrors(formErrors.fieldErrors);
      setIsPending(false);
    }
  };

  return {
    preview,
    handleChange,
    isPending,
    errorMessage,
    fieldErrors,
    handleSubmit,
  };
};
