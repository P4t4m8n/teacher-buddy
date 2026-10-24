"use client";

import { useState } from "react";

export const useDisclosure = (initiallyOpen: boolean = false) => {
  const [isOpen, setIsOpen] = useState<boolean>(initiallyOpen);

  const open = (): void => setIsOpen(true);
  const close = (): void => setIsOpen(false);

  return { isOpen, open, close };
};
