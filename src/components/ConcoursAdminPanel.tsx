import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getEventConcours,
  upsertEventConcours,
  revealConcoursLeaderboard,
  listConcoursVehiclesAdmin,
  deleteConcoursVehicle,
  listAllConcoursQuestionsAdmin,
  listConcoursQuestions,
  upsertConcoursQuestion,
  publishConcoursResults,
  generateConcoursWinnerBlurb,
  listConcoursScoresAdmin,
  updateConcoursScoreAdmin,
  deleteConcoursScoreAdmin,
  type EventConcours,
  type ConcoursQuestion,
  type ConcoursScoreRow,
} from "@/lib/concours.functions";
import { ImageUploadField } from "@/components/ImageUploadField";
import { Trophy, Eye, EyeOff, RefreshCw, Camera, Plus, Pencil } from "lucide-react";

type Props = { eventId: string | undefined; hasDestination?: boolean };

export function ConcoursAdminPanel({ eventId, hasDestination }: Props) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertEventConcours);
  const reveal = useServerFn(revealConcoursLeaderboard);
  const upsertQ = useServerFn(upsertConcoursQuestion);
  const publish = useServerFn(publishConcoursResults);
  const genBlurb = useServerFn(generateConcoursWinnerBlurb);
  const updateScore = useServerFn(updateConcoursScoreAdmin);
  const delScore = useServerFn(deleteConcoursScoreAdmin);
  const delVehicle = useServerFn(deleteConcoursVehicle);
  const [adminTab, setAdminTab] = useState<"settings" | "questions" | "scores" | "results">("settings");
