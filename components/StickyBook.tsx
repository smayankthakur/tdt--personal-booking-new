"use client";
import { useEffect, useState } from "react";

/** Price + Book button that follows the visitor while scrolling; hides once the booking section is on screen. */
export default function StickyBook({ price }: { price: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const book = document.getElementById("book");
    let past = false, inBook = false;
    const upd = () => setShow(past && !inBook);
    const onScroll = () => { past = window.scrollY > 280; upd(); };
    const io = new IntersectionObserver(([e]) => { inBook = e.isIntersecting; upd(); }, { threshold: 0.2 });
    if (book) io.observe(book);
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, []);
  return (
    <div className={`sticky-book${show ? " show" : ""}`} aria-hidden={!show}>
      <div><strong>{price}</strong><span>40 min voice call reading</span></div>
      <a href="#book" className="btn gold" tabIndex={show ? 0 : -1}>Book Now</a>
    </div>);
}
