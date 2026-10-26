"use client";

import { useEffect, useRef, useState } from "react";
import { getFileKind } from "@/helpers/assignment";
import type { TAssignmentFile } from "@/types/assignment.type";

// The file the user picked, ready to be shown before anything is uploaded. The browser makes a
// temporary address for it, which is released when another file is picked or the component goes away.
// `file` is the picked file itself, the one that is uploaded when the form is saved.
export const useFilePreview = () => {
  const [preview, setPreview] = useState<TAssignmentFile | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const picked: File | undefined = e.target.files?.[0];
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);

    urlRef.current = picked ? URL.createObjectURL(picked) : null;
    setFile(picked ?? null);
    setPreview(picked && urlRef.current ? { name: picked.name, kind: getFileKind(picked.type), url: urlRef.current } : null);
  };

  return { preview, file, handleChange };
};
