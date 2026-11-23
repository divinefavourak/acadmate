import { permanentRedirect } from "next/navigation";
import { HUB_PATH } from "@/lib/pastQuestions";

// /past-questions/jamb has no page of its own; the hub lists the JAMB subjects.
export default function JambIndex() {
  permanentRedirect(HUB_PATH);
}
