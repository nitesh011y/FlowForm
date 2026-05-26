"use client";

import type { RouterOutputs } from "@repo/trpc/client";
import Link from "next/link";
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Check,
  CircleDot,
  Coins,
  Copy,
  Crown,
  Eye,
  Gem,
  Hammer,
  Hash,
  HeartPulse,
  List,
  Loader2,
  Mail,
  Plus,
  Save,
  ScrollText,
  Send,
  Settings,
  Shield,
  SquareCheck,
  Star,
  Trash2,
  Type,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { trpc } from "~/trpc/client";

type FormDetail = NonNullable<RouterOutputs["forms"]["byId"]>;
type QuestionType = FormDetail["questions"][number]["type"];

type DraftOption = {
  id?: string;
  label: string;
  value: string;
  position: number;
};

type DraftValidation = {
  minLength: number | null;
  maxLength: number | null;
  min: number | null;
  max: number | null;
  pattern: string | null;
};

type DraftQuestion = {
  clientId: string;
  id?: string;
  type: QuestionType;
  title: string;
  description: string | null;
  required: boolean;
  position: number;
  placeholder: string | null;
  helpText: string | null;
  validation: DraftValidation;
  options: DraftOption[];
};

const questionTypes: Array<{ value: QuestionType; label: string }> = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "single_choice", label: "Single choice" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "dropdown", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "rating", label: "Rating" },
  { value: "yes_no", label: "Yes or no" },
];

const optionTypes: QuestionType[] = ["single_choice", "multiple_choice", "dropdown"];
const builderFontHref =
  "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700;800;900&display=swap";

const fieldPalette: Array<{
  icon: typeof Type;
  label: string;
  value: QuestionType;
}> = [
  { value: "short_text", label: "Short Text", icon: Type },
  { value: "long_text", label: "Long Text", icon: AlignLeft },
  { value: "email", label: "Email", icon: Mail },
  { value: "number", label: "Number", icon: Hash },
  { value: "single_choice", label: "Single Select", icon: CircleDot },
  { value: "multiple_choice", label: "Multiple Select", icon: SquareCheck },
  { value: "date", label: "Date", icon: CalendarDays },
  { value: "dropdown", label: "Dropdown", icon: List },
  { value: "rating", label: "Rating", icon: Star },
  { value: "yes_no", label: "Yes / No", icon: Check },
];

function iconForType(type: QuestionType) {
  return fieldPalette.find((item) => item.value === type)?.icon ?? Type;
}

function makeClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `draft-${Date.now()}-${Math.random()}`;
}

function labelForType(type: QuestionType) {
  return questionTypes.find((item) => item.value === type)?.label ?? type;
}

function isOptionType(type: QuestionType) {
  return optionTypes.includes(type);
}

function emptyValidation(): DraftValidation {
  return {
    minLength: null,
    maxLength: null,
    min: null,
    max: null,
    pattern: null,
  };
}

function normalizeValidation(value?: Partial<DraftValidation> | null): DraftValidation {
  return {
    minLength: value?.minLength ?? null,
    maxLength: value?.maxLength ?? null,
    min: value?.min ?? null,
    max: value?.max ?? null,
    pattern: value?.pattern ?? null,
  };
}

function parseNumberField(value: string, integer = false): number | null {
  if (!value.trim()) return null;
  const parsed = integer ? Number.parseInt(value, 10) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugValue(label: string) {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") || "option"
  );
}

function fromForm(form: FormDetail): DraftQuestion[] {
  return form.questions.map((question) => ({
    clientId: question.id,
    id: question.id,
    type: question.type,
    title: question.title,
    description: question.description,
    required: question.required,
    position: question.position,
    placeholder: question.placeholder,
    helpText: question.helpText,
    validation: normalizeValidation(question.validation),
    options: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      value: option.value,
      position: option.position,
    })),
  }));
}

function newQuestion(type: QuestionType = "short_text", position = 0): DraftQuestion {
  const options = isOptionType(type)
    ? [
        { label: "Option 1", value: "option-1", position: 0 },
        { label: "Option 2", value: "option-2", position: 1 },
      ]
    : [];

  return {
    clientId: makeClientId(),
    type,
    title: `${labelForType(type)} question`,
    description: null,
    required: false,
    position,
    placeholder: null,
    helpText: null,
    validation: emptyValidation(),
    options,
  };
}

export function BuilderClient({ formId }: { formId: string }) {
  const utils = trpc.useUtils();
  const formQuery = trpc.forms.byId.useQuery({ formId });
  const saveMutation = trpc.forms.saveBuilder.useMutation();
  const publishMutation = trpc.forms.publish.useMutation();
  const unpublishMutation = trpc.forms.unpublish.useMutation();
  const [copiedLink, setCopiedLink] = useState(false);
  const [hydratedFormId, setHydratedFormId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [visibility, setVisibility] = useState<"public" | "unlisted">("unlisted");
  const [theme, setTheme] = useState<{
    background: string;
    text: string;
    accent: string;
    preset?: string;
  }>({
    background: "#fafafa",
    text: "#18181b",
    accent: "#0f766e",
    preset: "default",
  });

  useEffect(() => {
    if (document.querySelector(`link[href="${builderFontHref}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = builderFontHref;
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    if (!formQuery.data || hydratedFormId === formQuery.data.id) return;

    const loadedQuestions = fromForm(formQuery.data);
    setTitle(formQuery.data.title);
    setDescription(formQuery.data.description ?? "");
    setQuestions(loadedQuestions.length ? loadedQuestions : [newQuestion("short_text", 0)]);
    setSelectedId(loadedQuestions[0]?.clientId ?? null);
    setStatus(formQuery.data.status);
    setVisibility(formQuery.data.visibility);
    setHydratedFormId(formQuery.data.id);
    if (formQuery.data.theme) {
      setTheme({
        background: formQuery.data.theme.background,
        text: formQuery.data.theme.text,
        accent: formQuery.data.theme.accent,
        preset: formQuery.data.theme.preset ?? "default",
      });
    }
  }, [formQuery.data, hydratedFormId]);

  const selectedQuestion = useMemo(
    () => questions.find((question) => question.clientId === selectedId) ?? questions[0],
    [questions, selectedId],
  );

  function applySavedForm(form: FormDetail) {
    const nextQuestions = fromForm(form);
    setTitle(form.title);
    setDescription(form.description ?? "");
    setQuestions(nextQuestions);
    setSelectedId((current) => {
      if (current && nextQuestions.some((question) => question.clientId === current))
        return current;
      return nextQuestions[0]?.clientId ?? null;
    });
    setStatus(form.status);
    setVisibility(form.visibility);
    setHydratedFormId(form.id);
    if (form.theme) {
      setTheme({
        background: form.theme.background,
        text: form.theme.text,
        accent: form.theme.accent,
        preset: form.theme.preset ?? "default",
      });
    }
  }

  function updateQuestion(clientId: string, patch: Partial<DraftQuestion>) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.clientId !== clientId) return question;
        const next = { ...question, ...patch };
        if (patch.type && isOptionType(patch.type) && next.options.length === 0) {
          next.options = [
            { label: "Option 1", value: "option-1", position: 0 },
            { label: "Option 2", value: "option-2", position: 1 },
          ];
        }
        return next;
      }),
    );
  }

  function updateValidation(clientId: string, patch: Partial<DraftValidation>) {
    setQuestions((current) =>
      current.map((question) =>
        question.clientId === clientId
          ? { ...question, validation: { ...question.validation, ...patch } }
          : question,
      ),
    );
  }

  function addQuestion(type: QuestionType = "short_text") {
    const question = newQuestion(type, questions.length);
    setQuestions((current) => [...current, question]);
    setSelectedId(question.clientId);
  }

  function removeQuestion(clientId: string) {
    setQuestions((current) => {
      const next = current.filter((question) => question.clientId !== clientId);
      if (!next.length) {
        const replacement = newQuestion("short_text", 0);
        setSelectedId(replacement.clientId);
        return [replacement];
      }
      setSelectedId(next[0]?.clientId ?? null);
      return next;
    });
  }

  function moveQuestion(clientId: string, direction: -1 | 1) {
    setQuestions((current) => {
      const index = current.findIndex((question) => question.clientId === clientId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;

      const next = [...current];
      const [question] = next.splice(index, 1);
      if (!question) return current;
      next.splice(nextIndex, 0, question);
      return next.map((item, position) => ({ ...item, position }));
    });
  }

  function addOption(clientId: string) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.clientId !== clientId) return question;
        const nextNumber = question.options.length + 1;
        return {
          ...question,
          options: [
            ...question.options,
            {
              label: `Option ${nextNumber}`,
              value: `option-${nextNumber}`,
              position: question.options.length,
            },
          ],
        };
      }),
    );
  }

  function updateOption(clientId: string, index: number, label: string) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.clientId !== clientId) return question;
        return {
          ...question,
          options: question.options.map((option, optionIndex) =>
            optionIndex === index
              ? {
                  ...option,
                  label,
                  value: slugValue(label),
                }
              : option,
          ),
        };
      }),
    );
  }

  function removeOption(clientId: string, index: number) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.clientId !== clientId) return question;
        return {
          ...question,
          options: question.options
            .filter((_, optionIndex) => optionIndex !== index)
            .map((option, position) => ({ ...option, position })),
        };
      }),
    );
  }

  async function saveBuilder() {
    const saved = await saveMutation.mutateAsync({
      formId,
      title,
      description: description.trim() || null,
      visibility,
      theme,
      questions: questions.map((question, index) => ({
        id: question.id,
        type: question.type,
        title: question.title,
        description: question.description?.trim() || null,
        required: question.required,
        position: index,
        placeholder: question.placeholder?.trim() || null,
        helpText: question.helpText?.trim() || null,
        validation: question.validation,
        options: isOptionType(question.type)
          ? question.options.map((option, optionIndex) => ({
              id: option.id,
              label: option.label,
              value: option.value || slugValue(option.label),
              position: optionIndex,
            }))
          : [],
      })),
    });

    applySavedForm(saved);
    await utils.forms.byId.invalidate({ formId });
    await utils.forms.list.invalidate();
    return saved;
  }

  async function publish() {
    await saveBuilder();
    const published = await publishMutation.mutateAsync({ formId });
    setStatus(published.status);
    await utils.forms.byId.invalidate({ formId });
    await utils.forms.list.invalidate();
  }

  async function unpublish() {
    const draft = await unpublishMutation.mutateAsync({ formId });
    setStatus(draft.status);
    await utils.forms.byId.invalidate({ formId });
    await utils.forms.list.invalidate();
  }

  const isWorking =
    saveMutation.isPending || publishMutation.isPending || unpublishMutation.isPending;
  const canSave = title.trim().length > 0 && questions.every((question) => question.title.trim());

  if (formQuery.isLoading) {
    return (
      <main className="theme-flowform-kingdom flex min-h-screen items-center justify-center bg-[#190704] text-[#fff8d7]">
        <div className="flex items-center border-4 border-[#f7df00] bg-[#2a100c] px-6 py-5 shadow-[8px_8px_0_#100402]">
          <Loader2 className="mr-3 size-5 animate-spin text-[#f7df00]" />
          <span className="font-flow-display text-2xl tracking-wider">Loading builder</span>
        </div>
      </main>
    );
  }

  if (formQuery.isError) {
    return (
      <main className="theme-flowform-kingdom flex min-h-screen flex-col items-center justify-center gap-4 bg-[#190704] px-5 text-center text-[#fff8d7]">
        <p className="font-flow-display text-5xl text-[#f7df00]">Sign in to open this builder</p>
        <Button asChild className="rounded-lg border border-[#72f09a] bg-[#20c968] font-black uppercase tracking-widest text-[#06180c] hover:bg-[#32df7c]">
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </main>
    );
  }

  if (!formQuery.data) {
    return (
      <main className="theme-flowform-kingdom flex min-h-screen items-center justify-center bg-[#190704] text-[#fff8d7]">
        <p className="border-4 border-[#f7df00] bg-[#2a100c] px-6 py-5 font-flow-display text-4xl text-[#f7df00]">
          Form not found
        </p>
      </main>
    );
  }

  const slug = formQuery.data.slug;
  const completionPercent = Math.min(
    100,
    Math.round(
      (title.trim() ? 20 : 0) +
        (description.trim() ? 10 : 0) +
        (questions.filter((question) => question.title.trim()).length /
          Math.max(questions.length, 1)) *
          55 +
        (status === "published" ? 15 : 0),
    ),
  );
  const selectedQuestionIndex = Math.max(
    questions.findIndex((question) => question.clientId === selectedQuestion?.clientId),
    0,
  );

  return (
    <main className="theme-flowform-kingdom min-h-screen overflow-hidden bg-[#190704] text-[#fff8d7] selection:bg-[#f7df00] selection:text-[#190704]">
      <header className="sticky top-0 z-50 border-b-4 border-[#5a2a22] bg-[#2a100c]/95 backdrop-blur-xl">
        <div className="flex min-h-20 items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-4 xl:gap-6">
            <Link className="font-flow-display text-4xl leading-none text-[#f7df00] drop-shadow-[3px_3px_0_#000] sm:text-5xl xl:text-6xl" href="/dashboard">
              FlowForm
            </Link>
            <span className="hidden h-12 w-px bg-[#6f4939] md:block" />
            <div className="hidden min-w-0 md:block">
              <p className="truncate text-3xl font-black text-[#fff7df]">{title || "Untitled form"}</p>
              <div className="mt-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#bfa48c]">
                <span>{status}</span>
                <span>/</span>
                <span>{visibility}</span>
              </div>
            </div>
          </div>

          <nav aria-label="Builder navigation" className="hidden items-center gap-2 rounded-md border border-[#5a2a22] bg-[#190704]/55 p-1 text-xs font-black uppercase tracking-[0.16em] text-[#d8c2af] lg:flex">
            <Link className="rounded px-4 py-2 transition hover:bg-[#351711] hover:text-[#f7df00]" href="/dashboard">
              Dashboard
            </Link>
            <span aria-current="page" className="rounded bg-[#f7df00] px-4 py-2 text-[#2a100c] shadow-[0_3px_0_#8a7200]">
              Builder
            </span>
            <Dialog>
              <DialogTrigger asChild>
                <button className="rounded px-4 py-2 transition hover:bg-[#351711] hover:text-[#f7df00]" type="button">
                  Design
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl rounded-none border-4 border-[#6f4939] bg-[#2a100c] text-[#fff8d7] shadow-[10px_10px_0_#100402]">
                <DialogHeader>
                  <DialogTitle className="font-flow-display text-5xl text-[#f7df00]">
                    Design the Realm
                  </DialogTitle>
                  <DialogDescription className="text-[#cdb49d]">
                    Choose a public form preset and tune the colors saved with this form.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-6">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      {
                        value: "default",
                        label: "Modern Default",
                        bg: "bg-[#0f766e]",
                        colors: { background: "#fafafa", text: "#18181b", accent: "#0f766e" },
                      },
                      {
                        value: "spiderman",
                        label: "Spider-Man",
                        bg: "bg-red-600",
                        colors: { background: "#0c1830", text: "#f8fafc", accent: "#ef4444" },
                      },
                      {
                        value: "batman",
                        label: "Dark Knight",
                        bg: "bg-neutral-800",
                        colors: { background: "#09090b", text: "#f4f4f5", accent: "#eab308" },
                      },
                      {
                        value: "cyberpunk",
                        label: "Cyberpunk",
                        bg: "bg-yellow-400",
                        colors: { background: "#0f0f15", text: "#facc15", accent: "#00f0ff" },
                      },
                      {
                        value: "sakura",
                        label: "Sakura",
                        bg: "bg-rose-300",
                        colors: { background: "#fff5f6", text: "#4c0519", accent: "#f43f5e" },
                      },
                    ].map((presetOption) => {
                      const isSelected = theme.preset === presetOption.value;
                      return (
                        <button
                          className={`border p-4 text-left transition ${
                            isSelected
                              ? "border-[#f7df00] bg-[#4a2319]"
                              : "border-[#6f4939] bg-[#371812] hover:border-[#f7df00]/60"
                          }`}
                          key={presetOption.value}
                          onClick={() => {
                            setTheme({
                              preset: presetOption.value,
                              background: presetOption.colors.background,
                              text: presetOption.colors.text,
                              accent: presetOption.colors.accent,
                            });
                          }}
                          type="button"
                        >
                          <span className={`mb-3 block size-5 rounded-sm ${presetOption.bg}`} />
                          <span className="font-black uppercase tracking-wider text-white">
                            {presetOption.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {(["background", "text", "accent"] as const).map((key) => (
                      <label className="space-y-2" key={key}>
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-[#bfa48c]">
                          {key}
                        </span>
                        <div className="flex gap-2">
                          <input
                            className="size-11 cursor-pointer border border-[#6f4939] bg-transparent p-1"
                            onChange={(event) =>
                              setTheme((current) => ({ ...current, [key]: event.target.value }))
                            }
                            type="color"
                            value={theme[key].startsWith("#") ? theme[key] : "#fafafa"}
                          />
                          <Input
                            className="h-11 rounded-md border-[#6f4939] bg-[#1b0906] text-[#fff8d7]"
                            onChange={(event) =>
                              setTheme((current) => ({ ...current, [key]: event.target.value }))
                            }
                            value={theme[key]}
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <DialogFooter className="border-t border-[#6f4939] pt-5">
                  <DialogTrigger asChild>
                    <Button className="rounded-lg border border-[#72f09a] bg-[#20c968] font-black uppercase tracking-[0.22em] text-[#06180c] shadow-[0_5px_0_#0a5528] hover:bg-[#32df7c]">
                      Done
                    </Button>
                  </DialogTrigger>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <button
              className="inline-flex items-center gap-2 rounded px-4 py-2 transition hover:bg-[#351711] hover:text-[#f7df00]"
              onClick={() => {
                const url = `${window.location.origin}/f/${slug}`;
                void navigator.clipboard.writeText(url);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              type="button"
            >
              <Copy className="size-4" />
              {copiedLink ? "Copied" : "Share"}
            </button>
            <Link className="inline-flex items-center gap-2 rounded px-4 py-2 transition hover:bg-[#351711] hover:text-[#f7df00]" href={`/forms/${formId}/results`}>
              <BarChart3 className="size-4" />
              Analytics
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            {status === "published" ? (
              <Button asChild size="icon" variant="ghost" className="text-[#ead7c0] hover:bg-[#3c1e17] hover:text-[#f7df00]">
                <Link href={`/f/${slug}`} target="_blank">
                  <Eye />
                </Link>
              </Button>
            ) : null}
            <Button
              size="icon"
              variant="ghost"
              className="text-[#ead7c0] hover:bg-[#3c1e17] hover:text-[#f7df00]"
              disabled={isWorking}
              onClick={() => void saveBuilder()}
            >
              {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
            </Button>
            <Button
              className="h-12 rounded-lg border border-[#72f09a] bg-[#8cf47d] px-4 text-sm font-black uppercase tracking-[0.16em] text-[#07180d] shadow-[0_6px_0_#0b642f] hover:bg-[#9cff8b] sm:h-14 sm:px-8 sm:text-lg"
              disabled={!canSave || isWorking}
              onClick={() => void (status === "published" ? saveBuilder() : publish())}
            >
              {publishMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
              Deploy
            </Button>
          </div>
        </div>
      </header>

      <section className="grid min-h-[calc(100vh-80px)] lg:grid-cols-[320px_minmax(460px,1fr)_400px]">
        <aside className="flex flex-col border-r-4 border-[#1a0a07] bg-[#43241d]">
          <div className="flex items-center gap-4 border-b border-[#70513f] px-5 py-6">
            <span className="grid size-14 place-items-center rounded-xl border border-[#f7df00] bg-[#f7df00] text-[#321812] shadow-[0_4px_0_#8f6d00]">
              <Hammer className="size-7" />
            </span>
            <div>
              <h2 className="text-3xl font-black text-white">The Forge</h2>
              <p className="font-bold text-[#cdb49d]">Arsenal Elements</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            <p className="font-flow-display text-2xl tracking-[0.22em] text-[#bfa48c]">Add Fields</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {fieldPalette.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    className="group flex min-h-24 flex-col items-center justify-center gap-3 rounded-xl border-2 border-[#70513f] bg-[#503029] px-3 text-center text-[#f7e7cf] transition hover:-translate-y-0.5 hover:border-[#f7df00] hover:bg-[#5a332b]"
                    key={tool.value}
                    onClick={() => addQuestion(tool.value)}
                    type="button"
                  >
                    <Icon className="size-6 text-[#f7df00] transition group-hover:scale-110" />
                    <span className="text-sm font-semibold">{tool.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8">
              <p className="font-flow-display text-2xl tracking-[0.22em] text-[#bfa48c]">
                Quest Order
              </p>
              <div className="mt-4 space-y-2">
                {questions.map((question, index) => {
                  const Icon = iconForType(question.type);
                  return (
                    <button
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        selectedQuestion?.clientId === question.clientId
                          ? "border-[#f7df00] bg-[#2b110c]"
                          : "border-[#70513f] bg-[#351711] hover:border-[#f7df00]/50"
                      }`}
                      key={question.clientId}
                      onClick={() => setSelectedId(question.clientId)}
                      type="button"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="size-4 text-[#f7df00]" />
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-widest text-[#bfa48c]">
                            Q{index + 1} / {labelForType(question.type)}
                          </p>
                          <p className="truncate text-sm font-bold text-white">{question.title}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-[#70513f] p-5">
            <Link
              className="flex h-16 items-center justify-center gap-3 rounded-lg border border-[#f7df00] bg-[#f7df00] text-lg font-black uppercase tracking-[0.18em] text-[#24100b] shadow-[0_6px_0_#8f6d00]"
              href="/pricing"
            >
              <Gem className="size-6" />
              Upgrade Realm
            </Link>
          </div>
        </aside>

        <section className="overflow-y-auto bg-[#210906] px-6 py-10">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10">
              <div className="flex items-end justify-between">
                <p className="font-flow-display text-3xl tracking-[0.22em] text-white">
                  Mana Progress
                </p>
                <p className="text-3xl font-black text-[#f7df00]">{completionPercent}%</p>
              </div>
              <div className="mt-3 rounded-full border-4 border-[#654437] bg-[#3b1b14] p-1 shadow-inner">
                <div
                  className="h-4 rounded-full bg-[linear-gradient(90deg,#6de1ff,#28aef7,#20c968)] shadow-[0_0_12px_rgba(109,225,255,0.5)]"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            <div className="relative mx-auto max-w-3xl">
              <span className="absolute -left-6 -top-5 z-10 grid size-16 -rotate-12 place-items-center rounded-lg border-4 border-[#6a4f24] bg-[#f7df00] text-[#513914] shadow-[0_8px_18px_rgba(0,0,0,0.35)]">
                <Shield className="size-9" />
              </span>
              <span className="absolute -right-6 -top-5 z-10 grid size-16 rotate-12 place-items-center rounded-lg border-4 border-[#6a4f24] bg-[#f7df00] text-[#513914] shadow-[0_8px_18px_rgba(0,0,0,0.35)]">
                <Crown className="size-9" />
              </span>

              <div className="min-h-[760px] rounded-sm bg-[#fff9ed] px-12 py-14 text-[#160705] shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
                <div className="border-b-2 border-[#2d160f] pb-6">
                  <Input
                    className="h-auto rounded-none border-0 bg-transparent px-0 text-4xl font-black text-[#160705] shadow-none focus-visible:ring-0"
                    onChange={(event) => setTitle(event.target.value)}
                    value={title}
                  />
                  <Textarea
                    className="mt-3 min-h-16 resize-none rounded-none border-0 bg-transparent px-0 text-base font-semibold text-[#6f635c] shadow-none focus-visible:ring-0"
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe the quest for your audience."
                    value={description}
                  />
                </div>

                <div className="mt-10 space-y-8">
                  {questions.map((question, index) => (
                    <article
                      className={`cursor-pointer rounded-xl border-4 p-7 transition ${
                        selectedQuestion?.clientId === question.clientId
                          ? "border-[#3b3425] bg-[#fffdf6] shadow-[0_4px_0_#bdb5a5]"
                          : "border-dashed border-[#c9c0ae] bg-[#fff9ed] opacity-45"
                      }`}
                      key={question.clientId}
                      onClick={() => setSelectedId(question.clientId)}
                    >
                      <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-[#8a8176]">Question {index + 1}</p>
                          <h3 className="mt-1 text-3xl font-black leading-tight text-[#160705]">
                            {question.title}
                            {question.required ? <span className="text-[#9f2b16]"> *</span> : null}
                          </h3>
                          {question.description ? (
                            <p className="mt-3 text-base font-semibold text-[#8a8176]">
                              {question.description}
                            </p>
                          ) : null}
                        </div>
                        <Badge className="border-[#5b4a35] bg-[#312719] text-[#fff1bc]" variant="outline">
                          {labelForType(question.type)}
                        </Badge>
                      </div>
                      <QuestionPreview question={question} />
                    </article>
                  ))}
                </div>
              </div>

              <span className="font-flow-display absolute -bottom-8 left-1/2 -translate-x-1/2 rounded-md border-4 border-[#7a552e] bg-[#9d5018] px-16 py-4 text-2xl tracking-[0.28em] text-[#ffe97a] shadow-[0_5px_0_#40200b]">
                Active Artifact
              </span>
            </div>
          </div>
        </section>

        <aside className="flex flex-col border-l-4 border-[#1a0a07] bg-[#43241d]">
          <div className="flex items-center gap-4 border-b border-[#70513f] px-8 py-7">
            <span className="grid size-12 place-items-center text-[#f7df00]">
              <Settings className="size-9" />
            </span>
            <div>
              <h2 className="text-3xl font-black text-white">The Treasury</h2>
              <p className="font-bold text-[#cdb49d]">Quest Configuration</p>
            </div>
          </div>

          {selectedQuestion ? (
            <div className="flex-1 overflow-y-auto px-8 py-7">
              <div className="mb-6 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#bfa48c]">
                  Artifact {selectedQuestionIndex + 1} of {questions.length}
                </p>
                <div className="flex gap-1">
                  <Button
                    className="text-[#ead7c0] hover:bg-[#3c1e17] hover:text-[#f7df00]"
                    onClick={() => moveQuestion(selectedQuestion.clientId, -1)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    className="text-[#ead7c0] hover:bg-[#3c1e17] hover:text-[#f7df00]"
                    onClick={() => moveQuestion(selectedQuestion.clientId, 1)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <ArrowDown />
                  </Button>
                </div>
              </div>

              <label className="block space-y-3">
                <span className="flex items-center gap-2 text-lg font-black uppercase tracking-[0.12em] text-[#bfa48c]">
                  <ScrollText className="size-4" />
                  Field Quest
                </span>
                <Textarea
                  className="min-h-20 rounded-lg border-2 border-[#70513f] bg-[#351711] text-xl font-bold text-[#fff8d7] placeholder:text-[#8d7b71]"
                  onChange={(event) =>
                    updateQuestion(selectedQuestion.clientId, { title: event.target.value })
                  }
                  value={selectedQuestion.title}
                />
              </label>

              <label className="mt-7 block space-y-3">
                <span className="flex items-center gap-2 text-lg font-black uppercase tracking-[0.12em] text-[#bfa48c]">
                  <Wand2 className="size-4" />
                  Placeholder Spell
                </span>
                <Input
                  className="h-16 rounded-lg border-2 border-[#70513f] bg-[#351711] text-lg text-[#fff8d7] placeholder:text-[#8d7b71]"
                  onChange={(event) =>
                    updateQuestion(selectedQuestion.clientId, {
                      placeholder: event.target.value,
                    })
                  }
                  placeholder="Type name here..."
                  value={selectedQuestion.placeholder ?? ""}
                />
              </label>

              <label className="mt-7 block space-y-3">
                <span className="text-lg font-black uppercase tracking-[0.12em] text-[#bfa48c]">
                  Field Type
                </span>
                <Select
                  onValueChange={(value) =>
                    updateQuestion(selectedQuestion.clientId, { type: value as QuestionType })
                  }
                  value={selectedQuestion.type}
                >
                  <SelectTrigger className="h-14 rounded-lg border-2 border-[#70513f] bg-[#351711] text-[#fff8d7]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {questionTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="mt-7 block space-y-3">
                <span className="text-lg font-black uppercase tracking-[0.12em] text-[#bfa48c]">
                  Description Lore
                </span>
                <Textarea
                  className="min-h-20 rounded-lg border-2 border-[#70513f] bg-[#351711] text-[#fff8d7]"
                  onChange={(event) =>
                    updateQuestion(selectedQuestion.clientId, {
                      description: event.target.value,
                    })
                  }
                  value={selectedQuestion.description ?? ""}
                />
              </label>

              <div className="mt-7 rounded-xl border-2 border-[#70513f] bg-[#1b0906] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xl font-black text-white">Required Loot</p>
                    <p className="text-xs font-black uppercase tracking-widest text-[#bfa48c]">
                      Hero must answer
                    </p>
                  </div>
                  <Switch
                    checked={selectedQuestion.required}
                    onCheckedChange={(required) =>
                      updateQuestion(selectedQuestion.clientId, { required })
                    }
                  />
                </div>
              </div>

              <div className="mt-7 rounded-xl border-2 border-[#70513f] bg-[#351711] p-5">
                <p className="text-lg font-black uppercase tracking-[0.12em] text-[#bfa48c]">
                  Deployment Cost
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="flex h-16 items-center justify-center gap-3 rounded-md border-2 border-[#70513f] bg-[#2a100c] text-xl font-black text-[#f7df00]">
                    <Coins className="size-6" />
                    {500 + questions.length * 50}
                  </div>
                  <div className="flex h-16 items-center justify-center gap-3 rounded-md border-2 border-[#70513f] bg-[#2a100c] text-xl font-black text-[#49ddff]">
                    <HeartPulse className="size-6" />
                    {Math.max(12, questions.length * 4)}
                  </div>
                </div>
              </div>

              <div className="mt-7 rounded-xl border-2 border-[#70513f] bg-[#351711] p-5">
                <p className="text-lg font-black uppercase tracking-[0.12em] text-[#bfa48c]">
                  Realm Visibility
                </p>
                <Select
                  onValueChange={(value) => setVisibility(value as "public" | "unlisted")}
                  value={visibility}
                >
                  <SelectTrigger className="mt-4 h-14 rounded-lg border-2 border-[#70513f] bg-[#2a100c] text-[#fff8d7]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public listing</SelectItem>
                    <SelectItem value="unlisted">Unlisted link</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {["short_text", "long_text", "email"].includes(selectedQuestion.type) ? (
                <div className="mt-7 rounded-xl border-2 border-[#70513f] bg-[#351711] p-5">
                  <p className="text-lg font-black uppercase tracking-[0.12em] text-[#bfa48c]">
                    Text Runes
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Input
                      className="h-12 rounded-lg border-[#70513f] bg-[#2a100c] text-[#fff8d7]"
                      min={0}
                      onChange={(event) =>
                        updateValidation(selectedQuestion.clientId, {
                          minLength: parseNumberField(event.target.value, true),
                        })
                      }
                      placeholder="Min"
                      type="number"
                      value={selectedQuestion.validation.minLength ?? ""}
                    />
                    <Input
                      className="h-12 rounded-lg border-[#70513f] bg-[#2a100c] text-[#fff8d7]"
                      min={1}
                      onChange={(event) =>
                        updateValidation(selectedQuestion.clientId, {
                          maxLength: parseNumberField(event.target.value, true),
                        })
                      }
                      placeholder="Max"
                      type="number"
                      value={selectedQuestion.validation.maxLength ?? ""}
                    />
                  </div>
                  <Input
                    className="mt-3 h-12 rounded-lg border-[#70513f] bg-[#2a100c] text-[#fff8d7]"
                    onChange={(event) =>
                      updateValidation(selectedQuestion.clientId, {
                        pattern: event.target.value || null,
                      })
                    }
                    placeholder="Pattern"
                    value={selectedQuestion.validation.pattern ?? ""}
                  />
                </div>
              ) : null}

              {["number", "rating"].includes(selectedQuestion.type) ? (
                <div className="mt-7 rounded-xl border-2 border-[#70513f] bg-[#351711] p-5">
                  <p className="text-lg font-black uppercase tracking-[0.12em] text-[#bfa48c]">
                    Number Runes
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Input
                      className="h-12 rounded-lg border-[#70513f] bg-[#2a100c] text-[#fff8d7]"
                      onChange={(event) =>
                        updateValidation(selectedQuestion.clientId, {
                          min: parseNumberField(event.target.value),
                        })
                      }
                      placeholder="Min"
                      type="number"
                      value={selectedQuestion.validation.min ?? ""}
                    />
                    <Input
                      className="h-12 rounded-lg border-[#70513f] bg-[#2a100c] text-[#fff8d7]"
                      onChange={(event) =>
                        updateValidation(selectedQuestion.clientId, {
                          max: parseNumberField(event.target.value),
                        })
                      }
                      placeholder="Max"
                      type="number"
                      value={selectedQuestion.validation.max ?? ""}
                    />
                  </div>
                </div>
              ) : null}

              {isOptionType(selectedQuestion.type) ? (
                <div className="mt-7 rounded-xl border-2 border-[#70513f] bg-[#351711] p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-black uppercase tracking-[0.12em] text-[#bfa48c]">
                      Guild Options
                    </p>
                    <Button
                      className="rounded-md border border-[#f7df00] bg-[#f7df00] text-[#24100b] hover:bg-[#ffe833]"
                      onClick={() => addOption(selectedQuestion.clientId)}
                      size="sm"
                    >
                      <Plus />
                      Add
                    </Button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {selectedQuestion.options.map((option, index) => (
                      <div className="flex gap-2" key={`${selectedQuestion.clientId}-${index}`}>
                        <Input
                          className="h-12 rounded-lg border-[#70513f] bg-[#2a100c] text-[#fff8d7]"
                          onChange={(event) =>
                            updateOption(selectedQuestion.clientId, index, event.target.value)
                          }
                          value={option.label}
                        />
                        <Button
                          className="text-[#ead7c0] hover:bg-[#3c1e17] hover:text-[#f7df00]"
                          onClick={() => removeOption(selectedQuestion.clientId, index)}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="border-t border-[#70513f] p-8">
            {status === "published" ? (
              <Button
                className="mb-4 h-14 w-full rounded-lg border border-[#70513f] bg-[#2a100c] text-sm font-black uppercase tracking-[0.18em] text-[#fff8d7] hover:bg-[#351711]"
                disabled={isWorking}
                onClick={() => void unpublish()}
              >
                Return to draft
              </Button>
            ) : null}
            <Button
              className="h-16 w-full rounded-lg border border-[#d30e1c] bg-[#b90012] text-lg font-black text-white shadow-[0_6px_0_#5f0008] hover:bg-[#d30016]"
              disabled={!selectedQuestion}
              onClick={() => selectedQuestion && removeQuestion(selectedQuestion.clientId)}
            >
              <Trash2 className="size-6" />
              Banish Element
            </Button>
          </div>
        </aside>
      </section>
    </main>
  );
}

function QuestionPreview({ question }: { question: DraftQuestion }) {
  if (question.type === "long_text") {
    return (
      <Textarea
        className="min-h-32 rounded-lg border-4 border-[#3b3425] bg-[#e9e3d8] text-[#160705] placeholder:text-[#9b9189]"
        disabled
        placeholder={question.placeholder ?? "Long answer"}
      />
    );
  }

  if (question.type === "single_choice" || question.type === "dropdown") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {question.options.map((option) => (
          <div
            className="flex items-center gap-3 rounded-lg border-4 border-dashed border-[#c9c0ae] bg-[#fff9ed] p-4 text-[#5f5249]"
            key={option.value}
          >
            <span className="grid size-6 place-items-center rounded-full border-2 border-[#3b3425]">
              {question.type === "dropdown" ? <Check className="size-3" /> : null}
            </span>
            <span className="font-semibold">{option.label}</span>
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "multiple_choice") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {question.options.map((option) => (
          <div
            className="flex items-center gap-3 rounded-lg border-4 border-dashed border-[#c9c0ae] bg-[#fff9ed] p-4 text-[#5f5249]"
            key={option.value}
          >
            <span className="size-6 rounded-sm border-2 border-[#3b3425]" />
            <span className="font-semibold">{option.label}</span>
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "rating") {
    return (
      <div className="flex flex-wrap gap-3">
        {[1, 2, 3, 4, 5].map((value) => (
          <span
            className="grid size-12 place-items-center rounded-lg border-4 border-[#3b3425] bg-[#e9e3d8] text-lg font-black"
            key={value}
          >
            {value}
          </span>
        ))}
      </div>
    );
  }

  if (question.type === "yes_no") {
    return (
      <div className="flex gap-3">
        <Button disabled variant="outline" className="rounded-lg border-4 border-[#3b3425] bg-[#e9e3d8] text-[#160705]">
          Yes
        </Button>
        <Button disabled variant="outline" className="rounded-lg border-4 border-[#3b3425] bg-[#e9e3d8] text-[#160705]">
          No
        </Button>
      </div>
    );
  }

  return (
    <Input
      className="h-20 rounded-lg border-4 border-[#3b3425] bg-[#e9e3d8] px-8 text-xl text-[#160705] placeholder:text-[#9b9189] shadow-[0_4px_0_#bdb5a5]"
      disabled
      placeholder={question.placeholder ?? labelForType(question.type)}
      type={question.type === "number" ? "number" : question.type === "date" ? "date" : "text"}
    />
  );
}
