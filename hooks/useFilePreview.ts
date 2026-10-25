"use client";

import { useEffect, useRef, useState } from "react";
import type { TAssignmentFile, TFileKind } from "@/types/assignment.type";

const kindOf = (mimeType: string): TFileKind => {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  return "other";
};

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
    setPreview(file && urlRef.current ? { name: file.name, kind: kindOf(file.type), url: urlRef.current } : null);
  };

  return { preview, handleChange };
};
