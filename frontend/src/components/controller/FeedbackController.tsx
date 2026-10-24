import { useState } from "react";
import type { ControllerStats, Rating } from "../../types/controller";

const ratings: Rating[] = [1, 2, 3, 4, 5];

interface FeedbackControllerProps {
  stats: ControllerStats;
  state: "idle" | "pending" | "success" | "error";
  message: string;
  onSubmit: (rating: Rating) => Promise<boolean>;
}

export default function FeedbackController({ stats, state, message, onSubmit }: FeedbackControllerProps) {
  const [selectedRating, setSelectedRating] = useState<Rating | null>(null);
  const selectionLocked = state === "pending" || state === "error";

  async function handleSubmit() {
    if (selectedRating === null) return;
    if (await onSubmit(selectedRating)) setSelectedRating(null);
  }

  return (
    <section className="controller-card" aria-labelledby="grow-heading">
      <div className="controller-card-heading">
        <h2 id="grow-heading">GROW Controller</h2>
      </div>
      <div className="controller-rating-group" role="group" aria-label="Meeting rating">
        {ratings.map((rating) => (
          <button
            className={`controller-star ${selectedRating !== null && rating <= selectedRating ? "controller-star-selected" : ""}`}
            key={rating}
            type="button"
            aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
            aria-pressed={selectedRating === rating}
            disabled={selectionLocked}
            onClick={() => setSelectedRating(rating)}
          >
            <span aria-hidden="true">{selectedRating !== null && rating <= selectedRating ? "★" : "☆"}</span>
          </button>
        ))}
      </div>
      <p className="controller-selection" aria-live="polite">
        {selectedRating === null ? "Select a rating from 1 to 5" : `Selected rating: ${selectedRating}/5`}
      </p>
      <button
        className="controller-action"
        type="button"
        disabled={selectedRating === null || state === "pending"}
        onClick={handleSubmit}
      >
        {state === "pending" ? "Submitting…" : state === "error" ? "Retry Rating" : "Submit Rating"}
      </button>
      <p className={`controller-message controller-message-${state}`} role="status" aria-live="polite">
        {message}
      </p>
      <dl className="controller-feedback-stats">
        <div>
          <dt>Average rating</dt>
          <dd>{stats.averageRating === null ? "No ratings yet" : `${stats.averageRating.toFixed(1)} / 5.0`}</dd>
        </div>
        <div>
          <dt>Feedback received</dt>
          <dd>{stats.feedbackCount.toLocaleString()}</dd>
        </div>
      </dl>
    </section>
  );
}
