import { useEffect, useState } from "react";

/** Height in px of the phone frame (`.phone`), kept up to date on resize. Used to pick a layout that fits the page. */
export function usePhoneHeight(): number {
  const [height, setHeight] = useState(() => document.querySelector(".phone")?.clientHeight ?? window.innerHeight);
  useEffect(() => {
    const phone = document.querySelector(".phone");
    if (!phone || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(phone.clientHeight));
    observer.observe(phone);
    setHeight(phone.clientHeight);
    return () => observer.disconnect();
  }, []);
  return height;
}
