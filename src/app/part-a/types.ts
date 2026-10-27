
export interface Story {
    id: number;
    title: string;
    phase: "practice" | "formal";
}

export interface Segment {
    id: number;
    content: string;
    segment_order: number;
    is_predictable: boolean;
}
