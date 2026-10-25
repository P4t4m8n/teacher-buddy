"use client";

import { useEffect, useRef, useState } from "react";
import { getFileKind } from "@/helpers/assignment";
import type { TAssignmentFile } from "@/types/assignment.type";

// The file the user picked, ready to be shown before anything is uploaded. The browser makes a
// temporary address for it, which is released when another file is picked or the component goes away.
export const useFilePreview = () => {
  const [preview, setPreview] = useState<TAssignmentFile | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file: File | undefined = e.target.files?.[0];
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);

    urlRef.current = file ? URL.createObjectURL(file) : null;
    setPreview(file && urlRef.current ? { name: file.name, kind: getFileKind(file.type), url: urlRef.current } : null);
  };

  return { preview, handleChange };
};
