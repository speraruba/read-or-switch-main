"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getApiPath } from "@/lib/api";
import { GENDER_OPTIONS, RACE_OPTIONS } from "@/lib/demographics";

function DemographicsForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const participantId = searchParams.get("participant_id");

    const [formData, setFormData] = useState({
        dob: "",
        age: "",
        gender: "",
        education: "",
        nativeSpeaker: "",
        firstLanguage: "",
        proficiencyReading: "",
        proficiencyWriting: "",
        isHispanic: "",
        race: "",
        knowledge: {
            "Bone grafts": "",
            "Hypertension": "",
            "Blood donation": "",
            "Multiple sclerosis": "",
            "Corneal transplants": "",
            "Kidney dialysis": "",
            "Liver cancer": "",
            "Vaccine": "",
            "Colorectal cancer": "",
            "Alzheimer's disease": "",
        } as Record<string, string>,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [hasStarted, setHasStarted] = useState(false);

    const handleStart = () => {
        setHasStarted(true);
    };

    const handleKnowledgeChange = (topic: string, value: string) => {
        setFormData((prev) => ({
            ...prev,
            knowledge: {
                ...prev.knowledge,
                [topic]: value,
            },
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!participantId) {
            alert("Missing Participant ID");
            return;
        }

        // Validate age > 18
        if (formData.dob) {
            const birthDate = new Date(formData.dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            
            // Adjust age if birthday hasn't occurred this year
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            if (age <= 18) {
                setError("You must be older than 18 years old to participate in this study.");
                return;
            }
        }

        setIsSubmitting(true);
        setError(""); // Clear any previous errors

        try {
            const [dobYear, dobMonth, dobDay] = formData.dob.split("-");
            const res = await fetch(getApiPath("/api/demographics"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    participantId,
                    ...formData,
                    dobYear,
                    dobMonth,
                    dobDay,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to submit");
            }

            // Immediately navigate, no success alert needed
            router.push(`/part-a?participant_id=${participantId}`);
        } catch (error: unknown) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : "An error occurred. Please try again.";
            setError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!participantId) {
        return <div className="p-8 text-center text-red-500">Error: No Participant ID provided.</div>;
    }

    if (!hasStarted) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <div className="max-w-md w-full glass-panel p-10 rounded-2xl shadow-lg text-center">
                    <h1 className="text-2xl font-bold mb-4 text-[var(--foreground)]">Welcome</h1>
                    <p className="text-[var(--muted)] mb-8">
                        Please click the button below to begin the study.
                    </p>
                    <button
                        onClick={handleStart}
                        className="bg-[var(--primary)] text-[var(--primary-fg)] px-8 py-3 rounded-lg font-medium hover:opacity-90 transition-all focus-ring shadow-sm w-full"
                    >
                        Begin Study
                    </button>
                </div>
            </div>
        );
    }

    // Shared input class (matching global design system)
    const inputClass = "block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)] shadow-sm focus-ring placeholder-[var(--muted)] transition-colors hover:border-[var(--foreground)]";
    const labelClass = "block text-sm font-medium text-[var(--foreground)] mb-2";
    const radioClass = "h-4 w-4 border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/20 cursor-pointer";
    const sectionClass = "p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]/50";

    return (
        <div className="min-h-screen p-6 sm:p-12">
            <div className="mx-auto max-w-3xl glass-panel rounded-2xl shadow-sm p-8 sm:p-10">
                <h1 className="mb-2 text-3xl font-semibold text-[var(--foreground)]">Demographic Information</h1>
                <p className="mb-10 text-[var(--muted)]">Please answer the following questions:</p>

                <form onSubmit={handleSubmit} className="space-y-10">
                    {/* Date of Birth */}
                    <div className={sectionClass}>
                        <label htmlFor="dob" className={labelClass}>Date of Birth</label>
                        <div>
                            <input
                                id="dob"
                                type="date"
                                className={`${inputClass} max-w-xs`}
                                value={formData.dob}
                                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    {/* Gender */}
                    <fieldset className={sectionClass}>
                        <legend className={`${labelClass} px-2`}>Gender</legend>
                        <div className="flex flex-wrap gap-x-6 gap-y-3">
                            {GENDER_OPTIONS.map((g) => (
                                <label key={g} className="inline-flex items-center cursor-pointer">
                                    <input
                                        id={g === "Male" ? "gender-male" : undefined}
                                        type="radio"
                                        name="gender"
                                        value={g}
                                        checked={formData.gender === g}
                                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                        className={radioClass}
                                        required
                                    />
                                    <span className="ml-2 text-[var(--foreground)]">{g}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    {/* Education */}
                    <div className={sectionClass}>
                        <label htmlFor="education-1" className={labelClass}>
                            Using the scale below, how many years of formal education did you complete?
                        </label>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-4">
                            {[
                                { val: "1", label: "Fewer than 8 years (1)" },
                                { val: "2", label: "Completed 8th grade (2)" },
                                { val: "3", label: "Some high school (3)" },
                                { val: "4", label: "Graduated high school (4)" },
                                { val: "5", label: "Some college (5)" },
                                { val: "6", label: "Graduated college (6)" },
                                { val: "7", label: "Master's degree (7)" },
                                { val: "8", label: "Doctoral or medical degree (8)" },
                            ].map((opt) => (
                                <label key={opt.val} className="flex items-center hover:bg-[var(--input-bg)] -mx-2 px-2 py-1 rounded-md transition-colors cursor-pointer">
                                    <input
                                        id={opt.val === "1" ? "education-1" : undefined}
                                        type="radio"
                                        name="education"
                                        value={opt.val}
                                        checked={formData.education === opt.val}
                                        onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                                        className={radioClass}
                                        required
                                    />
                                    <span className="ml-2 text-sm text-[var(--foreground)]">{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Native Speaker */}
                    <div className={sectionClass}>
                        <label htmlFor="nativeSpeaker-yes" className={labelClass}>Are you a native speaker of English?</label>
                        <div className="flex gap-6 mt-3">
                            {["Yes", "No"].map((opt) => (
                                <label key={opt} className="inline-flex items-center cursor-pointer">
                                    <input
                                        id={opt === "Yes" ? "nativeSpeaker-yes" : undefined}
                                        type="radio"
                                        name="nativeSpeaker"
                                        value={opt}
                                        checked={formData.nativeSpeaker === opt}
                                        onChange={(e) => setFormData({ ...formData, nativeSpeaker: e.target.value })}
                                        className={radioClass}
                                        required
                                    />
                                    <span className="ml-2 text-[var(--foreground)]">{opt}</span>
                                </label>
                            ))}
                        </div>

                        {/* First Language (Conditional) */}
                        {formData.nativeSpeaker === "No" && (
                            <div className="mt-6 pt-6 border-t border-[var(--border)]">
                                <label htmlFor="firstLanguage" className={labelClass}>If not, what is your first language?</label>
                                <div className="mt-2 space-y-3">
                                    <select
                                        id="firstLanguage"
                                        className={inputClass}
                                        value={[
                                            "Chinese", "Spanish", "Hindi", "Arabic", "Portuguese",
                                            "Bengali", "Russian", "Japanese", "German", "French", "Korean", "Italian"
                                        ].includes(formData.firstLanguage) ? formData.firstLanguage : (formData.firstLanguage ? "Other" : "")}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "Other") {
                                                setFormData({ ...formData, firstLanguage: "" });
                                            } else {
                                                setFormData({ ...formData, firstLanguage: val });
                                            }
                                        }}
                                        required={formData.nativeSpeaker === "No" && !formData.firstLanguage}
                                    >
                                        <option value="" disabled>Select a language</option>
                                        <option value="Chinese">Chinese</option>
                                        <option value="Spanish">Spanish</option>
                                        <option value="English">English</option>
                                        <option value="Hindi">Hindi</option>
                                        <option value="Arabic">Arabic</option>
                                        <option value="Portuguese">Portuguese</option>
                                        <option value="Bengali">Bengali</option>
                                        <option value="Russian">Russian</option>
                                        <option value="Japanese">Japanese</option>
                                        <option value="German">German</option>
                                        <option value="French">French</option>
                                        <option value="Korean">Korean</option>
                                        <option value="Italian">Italian</option>
                                        <option value="Other">Other</option>
                                    </select>

                                    {(![
                                        "Chinese", "Spanish", "English", "Hindi", "Arabic", "Portuguese",
                                        "Bengali", "Russian", "Japanese", "German", "French", "Korean", "Italian"
                                    ].includes(formData.firstLanguage) && formData.firstLanguage !== undefined) && (
                                            <input
                                                type="text"
                                                placeholder="Please specify"
                                                className={inputClass}
                                                value={formData.firstLanguage}
                                                onChange={(e) => setFormData({ ...formData, firstLanguage: e.target.value })}
                                                required
                                            />
                                        )}
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Proficiency */}
                    <div className={sectionClass}>
                        <label htmlFor="proficiency-reading-1" className={labelClass}>
                            How would you rate your overall proficiency in English? (1 = Not proficient, 7 = Native-level)
                        </label>
                        <div className="mt-6 space-y-6">
                            {["Reading", "Writing"].map((skill) => (
                                <div key={skill} className="flex items-center justify-between border-b border-[var(--border)] pb-4 last:border-0 last:pb-0">
                                    <span className="w-24 text-sm font-medium text-[var(--foreground)]">{skill}</span>
                                    <div className="flex flex-1 justify-between px-4 max-w-sm">
                                        {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                                            <label key={num} className="flex flex-col items-center cursor-pointer group">
                                                <span className="mb-2 text-xs text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors">{num}</span>
                                                <input
                                                    id={skill === "Reading" && num === 1 ? "proficiency-reading-1" : undefined}
                                                    type="radio"
                                                    name={`proficiency_${skill}`}
                                                    value={num}
                                                    checked={formData[skill === "Reading" ? "proficiencyReading" : "proficiencyWriting"] === String(num)}
                                                    onChange={(e) => setFormData({ ...formData, [skill === "Reading" ? "proficiencyReading" : "proficiencyWriting"]: e.target.value })}
                                                    className={radioClass}
                                                    required
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Ethnicity */}
                    <fieldset className={sectionClass}>
                        <legend className="px-2 text-lg font-medium text-[var(--foreground)]">Ethnicity</legend>
                        <fieldset>
                            <legend className={labelClass}>Are you Hispanic or Latino?</legend>
                            <div className="flex gap-6 mt-3">
                                {["Yes", "No"].map((opt) => (
                                    <label key={opt} className="inline-flex items-center cursor-pointer">
                                        <input
                                            id={opt === "Yes" ? "isHispanic-yes" : undefined}
                                            type="radio"
                                            name="isHispanic"
                                            value={opt}
                                            checked={formData.isHispanic === opt}
                                            onChange={(e) => setFormData({ ...formData, isHispanic: e.target.value })}
                                            className={radioClass}
                                            required
                                        />
                                        <span className="ml-2 text-[var(--foreground)]">{opt}</span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <fieldset className="mt-6">
                            <legend className={labelClass}>
                                Please check one of the following ethnic or racial categories that best describe you.
                            </legend>
                            <div className="mt-4 space-y-3">
                                {RACE_OPTIONS.map((race) => (
                                    <label key={race} className="flex items-center hover:bg-[var(--input-bg)] -mx-2 px-2 py-1 rounded-md transition-colors cursor-pointer">
                                        <input
                                            id={race === "Native American/Alaska Native" ? "race-native" : undefined}
                                            type="radio"
                                            name="race"
                                            value={race}
                                            checked={formData.race === race}
                                            onChange={(e) => setFormData({ ...formData, race: e.target.value })}
                                            className={radioClass}
                                            required
                                        />
                                        <span className="ml-2 text-sm text-[var(--foreground)]">{race}</span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                    </fieldset>

                    {/* Prior Knowledge */}
                    <div className={sectionClass}>
                        <h3 className="text-lg font-medium text-[var(--foreground)]">Prior knowledge question</h3>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                            How much do you already know about each of the following topics? (1 = Just a little, 7 = A lot)
                        </p>

                        <div className="mt-6 overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Topic</th>
                                        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                                            <th key={n} className="px-2 py-2 text-center text-xs font-medium text-[var(--muted)]">{n}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {Object.keys(formData.knowledge).map((topic) => (
                                        <tr key={topic} className="hover:bg-[var(--input-bg)] transition-colors">
                                            <td className="px-4 py-3 text-sm font-medium text-[var(--foreground)]">{topic}</td>
                                            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                                                <td key={n} className="px-2 py-3 text-center">
                                                    <input
                                                        type="radio"
                                                        name={`knowledge_${topic.replace(/[^a-zA-Z0-9]/g, "_")}`}
                                                        value={n}
                                                        checked={formData.knowledge[topic] === String(n)}
                                                        onChange={(e) => handleKnowledgeChange(topic, e.target.value)}
                                                        className={radioClass}
                                                        required
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-lg bg-red-50 p-4 border border-red-100">
                            <div className="flex">
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                                    <div className="mt-1 text-sm text-red-700">
                                        <p>{error}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-6">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded-lg bg-[var(--primary)] px-8 py-3 text-base font-medium text-[var(--primary-fg)] shadow-sm hover:opacity-90 active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "Submitting..." : "Submit"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function DemographicsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DemographicsForm />
        </Suspense>
    );
}
