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
import {
  listIdleLeaderboard,
  revealIdleLeaderboard,
  adminResetIdleTest,
  adminSetVehicleYearMeta,
} from "@/lib/idle-test.functions";
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
  const revealIdle = useServerFn(revealIdleLeaderboard);
  const resetIdle = useServerFn(adminResetIdleTest);
  const setVehicleMeta = useServerFn(adminSetVehicleYearMeta);
  const [adminTab, setAdminTab] = useState<"settings" | "questions" | "scores" | "results">("settings");


  const concoursQ = useQuery({
    queryKey: ["concours", eventId],
    enabled: !!eventId,
    queryFn: () => getEventConcours({ data: { eventId: eventId! } }),
  });
  const vehiclesQ = useQuery({
    queryKey: ["concours-vehicles-admin", eventId],
    enabled: !!eventId,
    queryFn: () => listConcoursVehiclesAdmin({ data: { eventId: eventId! } }),
  });
  const questionsQ = useQuery({
    queryKey: ["concours-questions-admin"],
    enabled: !!eventId,
    queryFn: () => listAllConcoursQuestionsAdmin(),
  });
  const pickedIds = concoursQ.data?.selected_question_ids ?? [];
  const pickedQ = useQuery({
    queryKey: ["concours-questions-picked", eventId, pickedIds],
    enabled: !!eventId && pickedIds.length > 0,
    queryFn: () => listConcoursQuestions({ data: { ids: pickedIds } }),
  });
  const scoresQ = useQuery({
    queryKey: ["concours-scores-admin", eventId],
    enabled: !!eventId && adminTab === "scores",
    queryFn: () => listConcoursScoresAdmin({ data: { eventId: eventId! } }),
  });
  const idleRunsQ = useQuery({
    queryKey: ["idle-tests", eventId],
    enabled: !!eventId,
    queryFn: () => listIdleLeaderboard({ data: { eventId: eventId! } }),
  });

  const [enabled, setEnabled] = useState(false);
  const [questionCount, setQuestionCount] = useState(10);
  const [prizeEn, setPrizeEn] = useState("");
  const [prizeAf, setPrizeAf] = useState("");
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Results form
  const [winnerVehicleId, setWinnerVehicleId] = useState<string>("");
  const [winnerPhotoUrl, setWinnerPhotoUrl] = useState("");
  const [winnerHeadlineEn, setWinnerHeadlineEn] = useState("");
  const [winnerHeadlineAf, setWinnerHeadlineAf] = useState("");
  const [winnerBlurbEn, setWinnerBlurbEn] = useState("");
  const [winnerBlurbAf, setWinnerBlurbAf] = useState("");
  const [blurbBusy, setBlurbBusy] = useState(false);

  const [resultsOnHome, setResultsOnHome] = useState(false);

  const [idleTestEnabled, setIdleTestEnabled] = useState(false);
  const [idlePrizeEn, setIdlePrizeEn] = useState("");
  const [idlePrizeAf, setIdlePrizeAf] = useState("");
  const [idleMsg, setIdleMsg] = useState<string | null>(null);
  const [metaDraft, setMetaDraft] = useState<
    Record<string, { year: string; make: string; model: string; powertrain: string }>
  >({});

  // Question editor
  const [editingQ, setEditingQ] = useState<Partial<ConcoursQuestion> & { scoring_type?: string } | null>(null);

  useEffect(() => {
    const c = concoursQ.data;
    if (c) {
      setEnabled(c.enabled);
      setQuestionCount(c.question_count);
      setPrizeEn(c.prize_en ?? "");
      setPrizeAf(c.prize_af ?? "");
      setSponsorName(c.sponsor_name ?? "");
      setSponsorLogoUrl(c.sponsor_logo_url ?? "");
      setWinnerVehicleId(c.winner_vehicle_id ?? "");
      setWinnerPhotoUrl(c.winner_photo_url ?? "");
      setWinnerHeadlineEn(c.winner_headline_en ?? "");
      setWinnerHeadlineAf(c.winner_headline_af ?? "");
      setWinnerBlurbEn(c.winner_blurb_en ?? "");
      setWinnerBlurbAf(c.winner_blurb_af ?? "");
      setResultsOnHome(!!c.results_on_home);
      setIdleTestEnabled(!!c.idle_test_enabled);
      setIdlePrizeEn(c.idle_prize_en ?? "");
      setIdlePrizeAf(c.idle_prize_af ?? "");
    }
  }, [concoursQ.data]);
