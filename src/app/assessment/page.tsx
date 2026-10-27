import { redirect } from "next/navigation";

// Legacy assessment links now lead to the end of the current study flow.
export default async function AssessmentPage({ searchParams }: {
    searchParams: Promise<{ participant_id?: string }>;
}): Promise<never> {
    const { participant_id } = await searchParams;
    redirect(`/complete${participant_id ? `?participant_id=${encodeURIComponent(participant_id)}` : ""}`);
}
