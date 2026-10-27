"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { getApiPath } from "@/lib/api";

export default function Home() {
  const [participantId, setParticipantId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [consented, setConsented] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consented || !participantId.trim() || !name.trim() || !email.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch(getApiPath("/api/participants"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, name, email, consented }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your details could not be saved. Please try again.");
      router.push(`/demographics?participant_id=${encodeURIComponent(data.participantId)}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Your details could not be saved. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl glass-panel rounded-2xl shadow-sm p-6 sm:p-8 lg:p-10">
        {/* Header */}
        <div className="text-center space-y-3 mb-8">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--foreground)]">
            Story Foraging Study
          </h1>
          <p className="text-[var(--muted)] text-base">
            Informed Consent Form
          </p>
        </div>

        {/* Consent Content */}
        <div className="mb-8 space-y-6">
          {/* Introduction */}
          <section className="space-y-3">
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              You are being asked to participate in a voluntary research study. The purpose of this study is to understand how people learn information through reading and searching from multiple texts. In this study, you will fill out surveys, learn different topics, answer what you have learned, and answer questions about the sentences you read. During the study, you will need to learn several topics under a limit of time. Some topics are more difficult than others. You can decide how you want to allocate your time. The goal is to learn as much as you can. After learning, you will need to report what you have learned and answer comprehension questions. You will receive additional bonus money if the accuracy of your comprehension questions is higher than 90%. Your participation will last about 60 minutes.
            </p>
          </section>

          {/* Principal Investigator */}
          <section className="rounded-xl bg-[var(--input-bg)] p-5 border border-[var(--border)]">
            <h2 className="text-base font-semibold text-[var(--foreground)] mb-3">Principal Investigator</h2>
            <div className="space-y-1 text-sm text-[var(--foreground)]">
              <p><strong>Name and Title:</strong> Jessie Chin, Associate Professor</p>
              <p><strong>Department and Institution:</strong> School of Information Sciences, University of Illinois Urbana-Champaign</p>
              <p><strong>Contact Information:</strong> <a href="mailto:chin5@illinois.edu" className="text-[var(--primary)] hover:underline">chin5@illinois.edu</a></p>
            </div>
          </section>

          {/* Procedures */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--foreground)]">What procedures are involved?</h2>
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              The study procedures are:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-[var(--foreground)] ml-4">
              <li>Completing a survey about your demographic information</li>
              <li>Learning information online</li>
              <li>Reporting what you have learned</li>
              <li>Reading sentences and answering comprehension questions</li>
            </ul>
            <p className="text-sm leading-relaxed text-[var(--foreground)] mt-3">
              During the online information learning task, you will do screen sharing with the researchers, so that the researchers will be able to monitor your progress. At the end of the learning task, you will be asked to recall what you have learned today as much as you can. When you start the recall, the Zoom meeting will be recorded (including the screen capture, your verbal response of free recall). The recall usually takes no more than 5 minutes. The recording will be turned off upon the completion of the recall. We will delete the video recording file (screen capture) right after the end of the study, and delete the audio recording files as soon as we complete the transcription of your recall response. No recording files will be stored for other uses.
            </p>
            <p className="text-sm leading-relaxed text-[var(--foreground)] font-medium">
              The study will last about 60 minutes.
            </p>
          </section>

          {/* Confidentiality */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Will my study-related information be kept confidential?</h2>
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              Faculty, students, and staff who may see your information will maintain confidentiality to the extent of laws and university policies. Your participant ID, name, and email address will be collected and stored with your study responses.
            </p>
          </section>

          {/* Reimbursement */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Will I be reimbursed for any expenses or paid for my participation in this research?</h2>
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              You will be paid $15 after the completion of the study. In addition, you will receive $5 bonus if the accuracy of comprehension questions is higher than 90%.
            </p>
          </section>

          {/* Withdrawal */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Can I withdraw or be removed from the study?</h2>
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              If you decide to participate, you are free to withdraw your consent and discontinue participation at any time. Your participation in this research is voluntary. Your decision whether or not to participate, or to withdraw after beginning participation, will not affect your current or future dealings with the University of Illinois Urbana-Champaign.
            </p>
          </section>

          {/* Data Use */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Will data collected from me be used for any other research?</h2>
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              Your data will not be used or distributed for other research.
            </p>
          </section>

          {/* Risks and Benefits */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--foreground)]">What are the risks and benefits of the study?</h2>
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              The study will pose no more than minimal risk to you. There is a risk of loss of confidentiality, given that a portion of the Zoom meeting will be recorded. The study is self-paced, with no potential risk of fatigue more than the everyday activities. There is no potential direct benefit to you. However, for our society, the study will advance understandings in learning sciences and have implications for designing technologies to support learning on your own.
            </p>
          </section>

          {/* Contact */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Who should I contact if I have questions?</h2>
            <p className="text-sm leading-relaxed text-[var(--foreground)]">
              Contact the researchers Jessie Chin, Associate Professor in Information Sciences, <a href="mailto:chin5@illinois.edu" className="text-[var(--primary)] hover:underline">chin5@illinois.edu</a> if you have any questions about this study or your part in it, or if you have concerns or complaints about the research.
            </p>
          </section>

          {/* Rights */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-[var(--foreground)]">What are my rights as a research subject?</h2>
          <p className="text-sm leading-relaxed text-[var(--foreground)]">
              If you have any questions about your rights as a research subject, including concerns, complaints, or to offer input, you may call the Office for the Protection of Research Subjects (OPRS) at <a href="tel:217-333-2670" className="text-[var(--primary)] hover:underline">217-333-2670</a> or e-mail OPRS at <a href="mailto:irb@illinois.edu" className="text-[var(--primary)] hover:underline">irb@illinois.edu</a>. If you would like to complete a brief survey to provide OPRS feedback about your experiences as a research participant, please follow the link here or through a link on the <a href="https://oprs.research.illinois.edu/" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">https://oprs.research.illinois.edu/</a>. You will have the option to provide feedback or concerns anonymously or you may provide your name and contact information for follow-up purposes.
            </p>
          </section>

          {/* Print Notice */}
          <section className="rounded-xl bg-[var(--input-bg)] p-4 border border-[var(--border)]">
            <p className="text-xs text-[var(--muted)] italic">
              Please print this consent form if you would like to retain a copy for your records.
          </p>
          </section>
        </div>

        {/* Consent Form */}
        <form onSubmit={handleSubmit} className="space-y-6 border-t border-[var(--border)] pt-6">
          <div className="space-y-2">
            <label
              htmlFor="participantId"
              className="block text-sm font-medium text-[var(--foreground)]"
            >
              Participant ID
            </label>
            <input
              id="participantId"
              name="participantId"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{1,19}"
              maxLength={19}
              disabled={isSubmitting}
              required
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] shadow-sm focus-ring placeholder-[var(--muted)] transition-colors hover:border-[var(--foreground)]"
              placeholder="Enter your assigned ID"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="participantName" className="block text-sm font-medium text-[var(--foreground)]">Full name</label>
            <input id="participantName" name="name" type="text" autoComplete="name" required maxLength={255} disabled={isSubmitting} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] shadow-sm focus-ring" />
          </div>
          <div className="space-y-2">
            <label htmlFor="participantEmail" className="block text-sm font-medium text-[var(--foreground)]">Email</label>
            <input id="participantEmail" name="email" type="email" autoComplete="email" required maxLength={255} disabled={isSubmitting} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email address" className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] shadow-sm focus-ring" />
          </div>

          <label
            htmlFor="consent"
            className="flex items-start gap-4 p-4 rounded-lg border border-[var(--border)] bg-[var(--input-bg)] hover:bg-[var(--input-bg)]/80 transition-colors cursor-pointer"
          >
            <div className="flex h-6 items-center pt-0.5">
              <input
                id="consent"
                name="consent"
                type="checkbox"
                required
                disabled={isSubmitting}
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                className="h-5 w-5 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20 cursor-pointer"
              />
            </div>
            <div className="text-sm flex-1">
              <span className="font-medium text-[var(--foreground)] cursor-pointer block mb-1">
                I have read and understand the above consent form.
              </span>
              <p className="text-[var(--muted)] leading-relaxed">
                I certify that I am a native speaker of English, and aged 18 years old or older. By clicking the &ldquo;Submit&rdquo; button to enter the survey, I indicate my willingness to voluntarily take part in this study.
              </p>
            </div>
          </label>

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting || !consented || !participantId.trim() || !name.trim() || !email.trim()}
            className="flex w-full justify-center rounded-lg bg-[var(--primary)] px-6 py-3 text-base font-medium text-[var(--primary-fg)] shadow-sm hover:opacity-90 active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isSubmitting ? "Saving…" : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}
