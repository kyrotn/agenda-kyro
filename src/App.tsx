"use client";

import {
  AlertTriangle,
  CalendarDays,
  CheckSquare2,
  ChevronDown,
  Circle,
  CircleCheckBig,
  Cloud,
  CloudOff,
  ExternalLink,
  LayoutDashboard,
  ListTodo,
  LoaderCircle,
  LogOut,
  Mail,
  Menu,
  Phone,
  Plus,
  Search,
  Settings2,
  Table2,
  Trash2,
  UserRoundPlus,
  Users,
  Workflow,
  X,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";

type Flow = {
  id: string;
  userId: string;
  ownerEmail: string;
  name: string;
  color: string;
  position: number;
  createdAt: string;
};

type Contact = {
  id: string;
  userId: string;
  ownerEmail: string;
  name: string;
  phone: string;
  city: string;
  niche: string;
  flowId: string;
  createdAt: string;
  updatedAt: string;
};

type Task = {
  id: string;
  userId: string;
  ownerEmail: string;
  title: string;
  contactId: string | null;
  flowId: string;
  priority: "Baixa" | "Media" | "Alta";
  dueDate: string;
  dueTime: string;
  status: "Aberta" | "Em andamento" | "Concluida";
  notes: string;
  calendarEventId: string;
  createdAt: string;
  updatedAt: string;
};

type AgendaData = {
  ownerEmail: string;
  flows: Flow[];
  contacts: Contact[];
  tasks: Task[];
  settings: {
    userId: string;
    ownerEmail: string;
    googleClientId: string;
    sheetId: string;
  };
};

type ViewName = "dashboard" | "contacts" | "tasks" | "flows" | "integrations";
type ModalName = "contact" | "task" | "flow" | null;

type GoogleSession = {
  connected: boolean;
  token: string;
  email: string;
  expiresAt: number;
};

type AuthUser = {
  id: string;
  email: string;
  name: string;
  picture: string;
};

const EMPTY_DATA: AgendaData = {
  ownerEmail: "",
  flows: [],
  contacts: [],
  tasks: [],
  settings: { userId: "", ownerEmail: "", googleClientId: "", sheetId: "" },
};

const EMPTY_GOOGLE: GoogleSession = {
  connected: false,
  token: "",
  email: "",
  expiresAt: 0,
};

function requireValidGoogleToken(session: GoogleSession) {
  if (!session.connected || !session.token || session.expiresAt <= Date.now()) {
    throw new Error("Conecte sua conta Google novamente.");
  }
  return session.token;
}

const NAV_ITEMS: Array<{ id: ViewName; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Visao geral", icon: LayoutDashboard },
  { id: "contacts", label: "Contatos", icon: Users },
  { id: "tasks", label: "Tarefas", icon: CheckSquare2 },
  { id: "flows", label: "Fluxos", icon: Workflow },
  { id: "integrations", label: "Integracoes", icon: Settings2 },
];

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

const LOGO_URL = `${import.meta.env.BASE_URL}kyro-logo.png`;

const DEFAULT_FLOWS = [
  { id: "flow-entrada", name: "Entrada", color: "#2a9d8f", position: 1 },
  { id: "flow-contato", name: "Em contato", color: "#3b82b8", position: 2 },
  { id: "flow-retorno", name: "Aguardando retorno", color: "#e09f3e", position: 3 },
  { id: "flow-reuniao", name: "Reuniao", color: "#7c6bc4", position: 4 },
  { id: "flow-concluido", name: "Concluido", color: "#4f9d69", position: 5 },
];

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function formatLongDate() {
  const value = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function whatsAppUrl(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return `https://wa.me/${digits}`;
}

function initials(value: string) {
  const source = value.split("@")[0].replace(/[._-]+/g, " ").trim();
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item.charAt(0).toUpperCase())
    .join("") || "K";
}

async function googleRequest<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const result = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message || "O Google recusou esta operacao.");
  return result;
}

function authUserFromSupabase(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email || "",
    name: String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Agenda Kyro"),
    picture: String(user.user_metadata?.avatar_url || user.user_metadata?.picture || ""),
  };
}

function googleSessionFromSupabase(session: Session | null): GoogleSession {
  if (!session?.provider_token) return EMPTY_GOOGLE;
  return {
    connected: true,
    token: session.provider_token,
    email: session.user.email || "",
    expiresAt: Date.now() + 55 * 60 * 1000,
  };
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

async function readAgendaData(user: AuthUser): Promise<AgendaData> {
  const [flowResult, contactResult, taskResult, settingsResult] = await Promise.all([
    supabase.from("kyro_flows").select("*").order("position", { ascending: true }),
    supabase.from("kyro_contacts").select("*").order("createdAt", { ascending: false }),
    supabase.from("kyro_tasks").select("*").order("dueDate", { ascending: true }).order("dueTime", { ascending: true }),
    supabase.from("kyro_settings").select("*").maybeSingle(),
  ]);

  for (const result of [flowResult, contactResult, taskResult, settingsResult]) {
    if (result.error) throw result.error;
  }

  let flowRows = (flowResult.data || []) as Flow[];
  if (!flowRows.length) {
    const seedRows = DEFAULT_FLOWS.map((flow) => ({
      ...flow,
      id: `${flow.id}:${user.id}`,
      userId: user.id,
      ownerEmail: user.email,
    }));
    const seedResult = await supabase.from("kyro_flows").insert(seedRows).select("*");
    if (seedResult.error) throw seedResult.error;
    flowRows = (seedResult.data || seedRows) as Flow[];
  }

  let setting = settingsResult.data as AgendaData["settings"] | null;
  if (!setting) {
    const settingRow = {
      userId: user.id,
      ownerEmail: user.email,
      googleClientId: "",
      sheetId: "",
    };
    const settingResult = await supabase.from("kyro_settings").insert(settingRow).select("*").single();
    if (settingResult.error) throw settingResult.error;
    setting = settingResult.data as AgendaData["settings"];
  }

  return {
    ownerEmail: user.email,
    flows: flowRows,
    contacts: (contactResult.data || []) as Contact[],
    tasks: (taskResult.data || []) as Task[],
    settings: setting,
  };
}

async function mutateAgenda(user: AuthUser, current: AgendaData, payload: Record<string, unknown>) {
  const action = clean(payload.action);
  const now = new Date().toISOString();
  let result: { error: Error | null } | null = null;

  if (action === "createContact") {
    const name = clean(payload.name);
    const phone = clean(payload.phone);
    if (!name || !phone) throw new Error("Informe o nome e o telefone.");
    if (current.contacts.some((contact) => normalizePhone(contact.phone) === normalizePhone(phone))) {
      throw new Error("Ja existe um contato com este telefone.");
    }
    result = await supabase.from("kyro_contacts").insert({
      id: crypto.randomUUID(), userId: user.id, ownerEmail: user.email, name, phone,
      city: clean(payload.city), niche: clean(payload.niche),
      flowId: clean(payload.flowId) || current.flows[0]?.id, createdAt: now, updatedAt: now,
    });
  } else if (action === "createTask") {
    const title = clean(payload.title);
    if (!title) throw new Error("Informe o titulo da tarefa.");
    result = await supabase.from("kyro_tasks").insert({
      id: crypto.randomUUID(), userId: user.id, ownerEmail: user.email, title,
      contactId: clean(payload.contactId) || null,
      flowId: clean(payload.flowId) || current.flows[0]?.id,
      priority: ["Baixa", "Media", "Alta"].includes(clean(payload.priority)) ? clean(payload.priority) : "Media",
      dueDate: clean(payload.dueDate), dueTime: clean(payload.dueTime), status: "Aberta",
      notes: clean(payload.notes), calendarEventId: "", createdAt: now, updatedAt: now,
    });
  } else if (action === "createFlow") {
    const name = clean(payload.name);
    if (!name) throw new Error("Informe o nome do fluxo.");
    if (current.flows.some((flow) => flow.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Ja existe um fluxo com este nome.");
    }
    const color = /^#[0-9a-f]{6}$/i.test(clean(payload.color)) ? clean(payload.color) : "#2a9d8f";
    result = await supabase.from("kyro_flows").insert({
      id: crypto.randomUUID(), userId: user.id, ownerEmail: user.email, name, color,
      position: current.flows.length + 1, createdAt: now,
    });
  } else if (action === "updateContactFlow") {
    result = await supabase.from("kyro_contacts").update({ flowId: clean(payload.flowId), updatedAt: now }).eq("id", clean(payload.contactId));
  } else if (action === "updateTaskStatus") {
    const status = ["Aberta", "Em andamento", "Concluida"].includes(clean(payload.status)) ? clean(payload.status) : "Aberta";
    result = await supabase.from("kyro_tasks").update({ status, updatedAt: now }).eq("id", clean(payload.taskId));
  } else if (action === "setTaskCalendarEvent") {
    result = await supabase.from("kyro_tasks").update({ calendarEventId: clean(payload.calendarEventId), updatedAt: now }).eq("id", clean(payload.taskId));
  } else if (action === "deleteContact") {
    const contactId = clean(payload.contactId);
    const unlinkResult = await supabase.from("kyro_tasks").update({ contactId: null, updatedAt: now }).eq("contactId", contactId);
    if (unlinkResult.error) throw unlinkResult.error;
    result = await supabase.from("kyro_contacts").delete().eq("id", contactId);
  } else if (action === "deleteTask") {
    result = await supabase.from("kyro_tasks").delete().eq("id", clean(payload.taskId));
  } else if (action === "updateSettings") {
    result = await supabase.from("kyro_settings").upsert({
      userId: user.id, ownerEmail: user.email,
      googleClientId: clean(payload.googleClientId), sheetId: clean(payload.sheetId), updatedAt: now,
    });
  } else {
    throw new Error("Operacao invalida.");
  }

  if (result?.error) throw result.error;
  return readAgendaData(user);
}

export function AgendaApp() {
  const [data, setData] = useState<AgendaData>(EMPTY_DATA);
  const [view, setView] = useState<ViewName>("dashboard");
  const [modal, setModal] = useState<ModalName>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(isSupabaseConfigured ? "" : "A conexao segura ainda precisa ser configurada.");
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [google, setGoogle] = useState<GoogleSession>(EMPTY_GOOGLE);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  useEffect(() => {
    let active = true;
    async function applySession(session: Session | null) {
      if (!active) return;
      if (!session?.user) {
        setAuthUser(null);
        setGoogle(EMPTY_GOOGLE);
        setData(EMPTY_DATA);
        setLoading(false);
        setAuthLoading(false);
        return;
      }

      const user = authUserFromSupabase(session.user);
      setAuthUser(user);
      setGoogle(googleSessionFromSupabase(session));
      setLoading(true);
      try {
        const result = await readAgendaData(user);
        if (active) setData(result);
      } catch (sessionError) {
        if (active) setError(sessionError instanceof Error ? sessionError.message : "Nao foi possivel abrir a agenda.");
      } finally {
        if (active) {
          setLoading(false);
          setAuthLoading(false);
        }
      }
    }

    if (!isSupabaseConfigured) {
      return () => { active = false; };
    }

    void supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (sessionError) {
        if (active) {
          setError(sessionError.message);
          setAuthLoading(false);
        }
        return;
      }
      void applySession(session);
    });

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void applySession(session), 0);
    });

    return () => {
      active = false;
      authSubscription.subscription.unsubscribe();
    };
  }, []);

  const mutate = useCallback(async (payload: Record<string, unknown>) => {
    if (!authUser) throw new Error("Entre com sua conta Google.");
    setSaving(true);
    setError("");
    try {
      const result = await mutateAgenda(authUser, data, payload);
      setData(result);
      return result;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Nao foi possivel salvar.";
      setError(message);
      throw saveError;
    } finally {
      setSaving(false);
    }
  }, [authUser, data]);

  const flowMap = useMemo(() => new Map(data.flows.map((flow) => [flow.id, flow])), [data.flows]);
  const contactMap = useMemo(() => new Map(data.contacts.map((contact) => [contact.id, contact])), [data.contacts]);
  const today = localIsoDate();

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return data.contacts;
    return data.contacts.filter((contact) =>
      [contact.name, contact.phone, contact.city, contact.niche, flowMap.get(contact.flowId)?.name || ""]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(term),
    );
  }, [data.contacts, flowMap, search]);

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return data.tasks;
    return data.tasks.filter((task) =>
      [task.title, task.notes, contactMap.get(task.contactId || "")?.name || "", flowMap.get(task.flowId)?.name || ""]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(term),
    );
  }, [contactMap, data.tasks, flowMap, search]);

  const openTasks = data.tasks.filter((task) => task.status !== "Concluida");
  const todayTasks = openTasks.filter((task) => task.dueDate === today);
  const doneTasks = data.tasks.filter((task) => task.status === "Concluida");
  const completion = data.tasks.length ? Math.round((doneTasks.length / data.tasks.length) * 100) : 0;

  const weekBars = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - 3 + index);
      const iso = localIsoDate(date);
      return {
        iso,
        label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", ""),
        count: data.tasks.filter((task) => task.dueDate === iso).length,
        isToday: iso === today,
      };
    });
  }, [data.tasks, today]);
  const maxWeekCount = Math.max(1, ...weekBars.map((bar) => bar.count));

  function changeView(nextView: ViewName) {
    setView(nextView);
    setMenuOpen(false);
  }

  async function createContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await mutate({
        action: "createContact",
        name: values.get("name"),
        phone: values.get("phone"),
        city: values.get("city"),
        niche: values.get("niche"),
        flowId: values.get("flowId"),
      });
      form.reset();
      setModal(null);
      showToast("Contato salvo.");
    } catch {
      // The error banner already contains the useful message.
    }
  }

  async function createFlow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await mutate({ action: "createFlow", name: values.get("name"), color: values.get("color") });
      form.reset();
      setModal(null);
      showToast("Fluxo criado.");
    } catch {
      // The error banner already contains the useful message.
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const previousIds = new Set(data.tasks.map((task) => task.id));
    try {
      const nextData = await mutate({
        action: "createTask",
        title: values.get("title"),
        contactId: values.get("contactId"),
        flowId: values.get("flowId"),
        priority: values.get("priority"),
        dueDate: values.get("dueDate"),
        dueTime: values.get("dueTime"),
        notes: values.get("notes"),
      });
      const createdTask = nextData.tasks.find((task) => !previousIds.has(task.id));
      const syncCalendar = values.get("syncCalendar") === "on";
      if (syncCalendar && createdTask && google.connected) {
        await syncTaskWithCalendar(createdTask, nextData);
      }
      form.reset();
      setModal(null);
      showToast(syncCalendar && google.connected ? "Tarefa salva e enviada ao Google Agenda." : "Tarefa salva.");
    } catch {
      // The error banner already contains the useful message.
    }
  }

  async function updateContactFlow(contactId: string, flowId: string) {
    try {
      await mutate({ action: "updateContactFlow", contactId, flowId });
      showToast("Contato movido.");
    } catch {
      // The error banner already contains the useful message.
    }
  }

  async function updateTaskStatus(taskId: string, status: Task["status"]) {
    try {
      await mutate({ action: "updateTaskStatus", taskId, status });
      showToast(status === "Concluida" ? "Tarefa concluida." : "Tarefa atualizada.");
    } catch {
      // The error banner already contains the useful message.
    }
  }

  async function removeContact(contact: Contact) {
    if (!window.confirm(`Excluir ${contact.name}?`)) return;
    try {
      await mutate({ action: "deleteContact", contactId: contact.id });
      showToast("Contato excluido.");
    } catch {
      // The error banner already contains the useful message.
    }
  }

  async function removeTask(task: Task) {
    if (!window.confirm(`Excluir a tarefa "${task.title}"?`)) return;
    try {
      await mutate({ action: "deleteTask", taskId: task.id });
      showToast("Tarefa excluida.");
    } catch {
      // The error banner already contains the useful message.
    }
  }

  async function signInWithGoogle() {
    if (!isSupabaseConfigured) {
      setError("A conexao segura ainda precisa ser configurada.");
      return;
    }
    setSyncing(true);
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: GOOGLE_SCOPES,
          redirectTo: new URL(import.meta.env.BASE_URL, window.location.href).toString(),
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (signInError) throw signInError;
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Nao foi possivel conectar ao Google.");
    } finally {
      setSyncing(false);
    }
  }

  async function connectGoogle() {
    await signInWithGoogle();
  }

  async function signOut() {
    setSyncing(true);
    setError("");
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    setSyncing(false);
  }

  async function syncTaskWithCalendar(task: Task, sourceData = data) {
    const token = requireValidGoogleToken(google);
    if (!task.dueDate) throw new Error(`A tarefa ${task.title} nao possui data.`);
    const contact = sourceData.contacts.find((item) => item.id === task.contactId);
    const flow = sourceData.flows.find((item) => item.id === task.flowId);
    const start = new Date(`${task.dueDate}T${task.dueTime || "09:00"}:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const event = {
      summary: contact ? `Kyro: ${task.title} - ${contact.name}` : `Kyro: ${task.title}`,
      description: [
        `Fluxo: ${flow?.name || "Sem fluxo"}`,
        `Prioridade: ${task.priority}`,
        contact ? `Contato: ${contact.name}` : "",
        contact?.phone ? `Telefone: ${contact.phone}` : "",
        contact?.city ? `Cidade: ${contact.city}` : "",
        task.notes ? `Observacoes: ${task.notes}` : "",
      ].filter(Boolean).join("\n"),
      start: { dateTime: start.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo" },
      end: { dateTime: end.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo" },
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }] },
    };
    const endpoint = task.calendarEventId
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(task.calendarEventId)}`
      : "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    const result = await googleRequest<{ id: string }>(token, endpoint, {
      method: task.calendarEventId ? "PATCH" : "POST",
      body: JSON.stringify(event),
    });
    if (!task.calendarEventId && result.id) {
      await mutate({ action: "setTaskCalendarEvent", taskId: task.id, calendarEventId: result.id });
    }
  }

  async function syncCalendar() {
    setSyncing(true);
    setError("");
    try {
      const candidates = data.tasks.filter((task) => task.status !== "Concluida" && task.dueDate);
      for (const task of candidates) await syncTaskWithCalendar(task);
      showToast(`${candidates.length} tarefa(s) sincronizada(s) com o Google Agenda.`);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Nao foi possivel sincronizar a agenda.");
    } finally {
      setSyncing(false);
    }
  }

  async function syncSheets() {
    setSyncing(true);
    setError("");
    try {
      const token = requireValidGoogleToken(google);
      let sheetId = data.settings.sheetId;
      if (!sheetId) {
        const spreadsheet = await googleRequest<{ spreadsheetId: string }>(
          token,
          "https://sheets.googleapis.com/v4/spreadsheets",
          {
            method: "POST",
            body: JSON.stringify({
              properties: { title: "Kyro Agenda Particular" },
              sheets: ["Contatos", "Tarefas", "Fluxos"].map((title) => ({ properties: { title } })),
            }),
          },
        );
        sheetId = spreadsheet.spreadsheetId;
        await mutate({ action: "updateSettings", googleClientId: data.settings.googleClientId, sheetId });
      }

      await googleRequest(token, `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: [
            {
              range: "Contatos!A1",
              values: [
                ["Nome", "Telefone", "Cidade", "Nicho", "Fluxo"],
                ...data.contacts.map((contact) => [
                  contact.name,
                  contact.phone,
                  contact.city,
                  contact.niche,
                  flowMap.get(contact.flowId)?.name || "",
                ]),
              ],
            },
            {
              range: "Tarefas!A1",
              values: [
                ["Tarefa", "Contato", "Fluxo", "Prioridade", "Data", "Hora", "Status"],
                ...data.tasks.map((task) => [
                  task.title,
                  contactMap.get(task.contactId || "")?.name || "",
                  flowMap.get(task.flowId)?.name || "",
                  task.priority,
                  task.dueDate,
                  task.dueTime,
                  task.status,
                ]),
              ],
            },
            {
              range: "Fluxos!A1",
              values: [["Fluxo", "Cor", "Ordem"], ...data.flows.map((flow) => [flow.name, flow.color, flow.position])],
            },
          ],
        }),
      });
      showToast("Google Planilhas atualizado.");
    } catch (sheetError) {
      setError(sheetError instanceof Error ? sheetError.message : "Nao foi possivel atualizar a planilha.");
    } finally {
      setSyncing(false);
    }
  }

  async function sendGmailSummary() {
    setSyncing(true);
    setError("");
    try {
      const token = requireValidGoogleToken(google);
      const recipient = google.email || data.ownerEmail;
      const body = [
        `Kyro Agenda - ${new Intl.DateTimeFormat("pt-BR").format(new Date())}`,
        "",
        `Contatos: ${data.contacts.length}`,
        `Tarefas abertas: ${openTasks.length}`,
        `Tarefas para hoje: ${todayTasks.length}`,
        "",
        "Agenda de hoje:",
        ...(todayTasks.length
          ? todayTasks.map((task) => `- ${task.dueTime || "Sem hora"} | ${task.title}`)
          : ["- Nenhuma tarefa para hoje."]),
      ].join("\r\n");
      const message = [
        `To: ${recipient}`,
        `From: ${recipient}`,
        `Subject: Resumo Kyro - ${new Intl.DateTimeFormat("pt-BR").format(new Date())}`,
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="UTF-8"',
        "",
        body,
      ].join("\r\n");
      const bytes = new TextEncoder().encode(message);
      let binary = "";
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      const raw = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      await googleRequest(token, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        body: JSON.stringify({ raw }),
      });
      showToast(`Resumo enviado para ${recipient}.`);
    } catch (mailError) {
      setError(mailError instanceof Error ? mailError.message : "Nao foi possivel enviar o resumo.");
    } finally {
      setSyncing(false);
    }
  }

  function renderFlowBoard(compact = false) {
    return (
      <div className={`kanban${compact ? " is-compact" : ""}`}>
        {data.flows.map((flow) => {
          const flowContacts = data.contacts.filter((contact) => contact.flowId === flow.id);
          const visibleContacts = compact ? flowContacts.slice(0, 3) : flowContacts;
          return (
            <section className="flow-lane" key={flow.id} style={{ "--flow-color": flow.color } as React.CSSProperties}>
              <header className="flow-lane-head">
                <span className="flow-dot" />
                <strong>{flow.name}</strong>
                <span>{flowContacts.length}</span>
              </header>
              <div className="flow-leads">
                {visibleContacts.map((contact) => (
                  <article className="lead-row" key={contact.id}>
                    <span className="lead-avatar">{initials(contact.name)}</span>
                    <span className="lead-copy">
                      <strong>{contact.name}</strong>
                      <small>{contact.niche || contact.phone}</small>
                    </span>
                    {!compact && (
                      <select
                        aria-label={`Mover ${contact.name}`}
                        value={contact.flowId}
                        onChange={(event) => void updateContactFlow(contact.id, event.target.value)}
                      >
                        {data.flows.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                      </select>
                    )}
                  </article>
                ))}
                {!visibleContacts.length && <p className="lane-empty">Nenhum contato</p>}
                {compact && flowContacts.length > visibleContacts.length && (
                  <button className="lane-more" type="button" onClick={() => changeView("flows")}>
                    +{flowContacts.length - visibleContacts.length} contato(s)
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  function renderDashboard() {
    return (
      <>
        <div className="page-heading">
          <div>
            <span className="page-kicker">Agenda particular</span>
            <h1>Visao geral</h1>
            <p>{formatLongDate()}</p>
          </div>
          <div className="heading-actions">
            <button className="button secondary" type="button" onClick={() => setModal("task")}>
              <ListTodo size={17} /> Nova tarefa
            </button>
            <button className="button primary" type="button" onClick={() => setModal("contact")}>
              <UserRoundPlus size={17} /> Novo contato
            </button>
          </div>
        </div>

        <section className="stats-row" aria-label="Resumo">
          <Stat icon={<Users />} value={data.contacts.length} label="Contatos" tone="teal" />
          <Stat icon={<ListTodo />} value={openTasks.length} label="Tarefas abertas" tone="blue" />
          <Stat icon={<CalendarDays />} value={todayTasks.length} label="Compromissos hoje" tone="amber" />
          <Stat icon={<CircleCheckBig />} value={doneTasks.length} label="Concluidas" tone="green" />
        </section>

        <div className="dashboard-grid">
          <section className="surface pulse-panel">
            <PanelHead title="Ritmo da semana" subtitle="Tarefas programadas por dia" />
            <div className="pulse-layout">
              <div className="completion-ring" style={{ "--completion": `${completion * 3.6}deg` } as React.CSSProperties}>
                <span><strong>{completion}%</strong><small>concluido</small></span>
              </div>
              <div className="week-chart">
                {weekBars.map((bar) => (
                  <div className={`week-bar${bar.isToday ? " is-today" : ""}`} key={bar.iso}>
                    <span className="bar-value">{bar.count || ""}</span>
                    <span className="bar-track"><i style={{ height: `${Math.max(12, (bar.count / maxWeekCount) * 100)}%` }} /></span>
                    <small>{bar.label}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="surface today-panel">
            <PanelHead title="Hoje" subtitle={`${todayTasks.length} tarefa(s)`} action={<button className="icon-button" title="Abrir tarefas" aria-label="Abrir tarefas" onClick={() => changeView("tasks")}><ExternalLink size={17} /></button>} />
            <div className="today-list">
              {todayTasks.slice(0, 6).map((task) => (
                <article className="today-item" key={task.id}>
                  <time>{task.dueTime || "--:--"}</time>
                  <span className="today-marker" style={{ background: flowMap.get(task.flowId)?.color }} />
                  <span className="today-copy"><strong>{task.title}</strong><small>{contactMap.get(task.contactId || "")?.name || flowMap.get(task.flowId)?.name}</small></span>
                  <button className="icon-button quiet" type="button" title="Concluir" aria-label={`Concluir ${task.title}`} onClick={() => void updateTaskStatus(task.id, "Concluida")}><Circle size={18} /></button>
                </article>
              ))}
              {!todayTasks.length && <EmptyState icon={<CalendarDays />} title="Dia livre" text="Nenhuma tarefa marcada para hoje." />}
            </div>
          </section>
        </div>

        <section className="surface flow-panel">
          <PanelHead title="Fluxo comercial" subtitle="Contatos por etapa" action={<button className="button text" type="button" onClick={() => changeView("flows")}>Ver todos</button>} />
          {renderFlowBoard(true)}
        </section>
      </>
    );
  }

  function renderContacts() {
    return (
      <>
        <div className="page-heading compact-heading">
          <div><span className="page-kicker">Relacionamento</span><h1>Contatos</h1><p>{data.contacts.length} pessoa(s) cadastrada(s)</p></div>
          <button className="button primary" type="button" onClick={() => setModal("contact")}><Plus size={17} /> Adicionar contato</button>
        </div>
        <section className="surface data-surface">
          <div className="table-toolbar">
            <strong>Todos os contatos</strong>
            <span>{filteredContacts.length} resultado(s)</span>
          </div>
          <div className="contact-table" role="table" aria-label="Contatos">
            <div className="contact-table-head" role="row">
              <span>Contato</span><span>Telefone</span><span>Nicho</span><span>Fluxo</span><span aria-label="Acoes" />
            </div>
            {filteredContacts.map((contact) => (
              <div className="contact-row" role="row" key={contact.id}>
                <div className="person-cell"><span className="lead-avatar">{initials(contact.name)}</span><span><strong>{contact.name}</strong><small>{contact.city || "Cidade nao informada"}</small></span></div>
                <a className="phone-link" href={whatsAppUrl(contact.phone)} target="_blank" rel="noreferrer"><Phone size={15} /> {contact.phone}</a>
                <span>{contact.niche || "Sem nicho"}</span>
                <label className="select-wrap"><span className="flow-dot" style={{ background: flowMap.get(contact.flowId)?.color }} /><select aria-label={`Fluxo de ${contact.name}`} value={contact.flowId} onChange={(event) => void updateContactFlow(contact.id, event.target.value)}>{data.flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}</select><ChevronDown size={14} /></label>
                <button className="icon-button danger" type="button" title="Excluir contato" aria-label={`Excluir ${contact.name}`} onClick={() => void removeContact(contact)}><Trash2 size={16} /></button>
              </div>
            ))}
            {!filteredContacts.length && <EmptyState icon={<Users />} title="Nenhum contato" text="Adicione o primeiro contato para iniciar seu fluxo." />}
          </div>
        </section>
      </>
    );
  }

  function renderTasks() {
    return (
      <>
        <div className="page-heading compact-heading">
          <div><span className="page-kicker">Organizacao</span><h1>Tarefas</h1><p>{openTasks.length} tarefa(s) em aberto</p></div>
          <button className="button primary" type="button" onClick={() => setModal("task")}><Plus size={17} /> Nova tarefa</button>
        </div>
        <section className="surface data-surface">
          <div className="task-filters">
            <span className="filter-chip is-active">Todas {filteredTasks.length}</span>
            <span className="filter-chip">Hoje {todayTasks.length}</span>
            <span className="filter-chip">Concluidas {doneTasks.length}</span>
          </div>
          <div className="task-list">
            {filteredTasks.map((task) => {
              const contact = contactMap.get(task.contactId || "");
              const flow = flowMap.get(task.flowId);
              return (
                <article className={`task-row${task.status === "Concluida" ? " is-done" : ""}`} key={task.id}>
                  <button className="task-check" type="button" title={task.status === "Concluida" ? "Reabrir" : "Concluir"} aria-label={`${task.status === "Concluida" ? "Reabrir" : "Concluir"} ${task.title}`} onClick={() => void updateTaskStatus(task.id, task.status === "Concluida" ? "Aberta" : "Concluida")}>
                    {task.status === "Concluida" ? <CircleCheckBig size={21} /> : <Circle size={21} />}
                  </button>
                  <span className="task-main"><strong>{task.title}</strong><small>{contact?.name || "Sem contato"}{task.notes ? ` · ${task.notes}` : ""}</small></span>
                  <span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                  <span className="flow-label"><i style={{ background: flow?.color }} />{flow?.name || "Sem fluxo"}</span>
                  <span className="date-cell"><CalendarDays size={15} /> {formatDate(task.dueDate)} {task.dueTime}</span>
                  <select className="status-select" aria-label={`Status de ${task.title}`} value={task.status} onChange={(event) => void updateTaskStatus(task.id, event.target.value as Task["status"])}>
                    <option>Aberta</option><option>Em andamento</option><option>Concluida</option>
                  </select>
                  <button className="icon-button danger" type="button" title="Excluir tarefa" aria-label={`Excluir ${task.title}`} onClick={() => void removeTask(task)}><Trash2 size={16} /></button>
                </article>
              );
            })}
            {!filteredTasks.length && <EmptyState icon={<CheckSquare2 />} title="Nenhuma tarefa" text="Crie uma tarefa para organizar o proximo passo." />}
          </div>
        </section>
      </>
    );
  }

  function renderFlows() {
    return (
      <>
        <div className="page-heading compact-heading">
          <div><span className="page-kicker">Pipeline</span><h1>Fluxos</h1><p>Organize cada contato na etapa certa</p></div>
          <button className="button primary" type="button" onClick={() => setModal("flow")}><Plus size={17} /> Novo fluxo</button>
        </div>
        {renderFlowBoard(false)}
      </>
    );
  }

  function renderIntegrations() {
    return (
      <>
        <div className="page-heading compact-heading">
          <div><span className="page-kicker">Sua conta</span><h1>Integracoes</h1><p>Google Agenda, Gmail e Planilhas</p></div>
          <span className={`connection-badge ${google.connected ? "is-connected" : ""}`}>{google.connected ? <Cloud size={16} /> : <CloudOff size={16} />}{google.connected ? "Google conectado" : "Google desconectado"}</span>
        </div>
        <div className="integration-grid">
          <section className="surface integration-setup">
            <PanelHead title="Acesso Google" subtitle="Sua conta principal" />
            <div className="connected-account is-primary">
              <span className="google-mark">G</span>
              <span><strong>Agenda particular</strong><small>Acesso direto, sem conta vinculada</small></span>
            </div>
            <div className="service-authorization">
              <span><strong>Agenda, Gmail e Planilhas</strong><small>{google.connected ? "Servicos autorizados" : "Autorizacao adicional necessaria"}</small></span>
              <button className={google.connected ? "button secondary" : "button primary"} type="button" onClick={() => google.connected ? setGoogle(EMPTY_GOOGLE) : void connectGoogle()} disabled={syncing}>
                {syncing ? <LoaderCircle className="spin" size={17} /> : google.connected ? <CloudOff size={17} /> : <Cloud size={17} />}
                {google.connected ? "Desconectar servicos" : "Autorizar servicos"}
              </button>
            </div>
          </section>

          <section className="surface integration-actions">
            <PanelHead title="Sincronizacao" subtitle="Servicos conectados" />
            <IntegrationRow icon={<CalendarDays />} tone="calendar" title="Google Agenda" detail={`${data.tasks.filter((task) => task.calendarEventId).length} tarefa(s) vinculada(s)`} action="Sincronizar" onClick={() => void syncCalendar()} disabled={!google.connected || syncing} />
            <IntegrationRow icon={<Table2 />} tone="sheets" title="Google Planilhas" detail={data.settings.sheetId ? "Planilha Kyro criada" : "Aguardando primeira sincronizacao"} action="Atualizar" onClick={() => void syncSheets()} disabled={!google.connected || syncing} />
            <IntegrationRow icon={<Mail />} tone="gmail" title="Gmail" detail="Resumo da agenda" action="Enviar resumo" onClick={() => void sendGmailSummary()} disabled={!google.connected || syncing} />
          </section>

          <section className="surface quick-links-panel">
            <PanelHead title="Atalhos Google" subtitle="Abrir em uma nova guia" />
            <div className="quick-link-grid">
              <a href="https://calendar.google.com" target="_blank" rel="noreferrer"><CalendarDays size={20} /><span>Agenda</span><ExternalLink size={14} /></a>
              <a href="https://mail.google.com" target="_blank" rel="noreferrer"><Mail size={20} /><span>Gmail</span><ExternalLink size={14} /></a>
              <a href={data.settings.sheetId ? `https://docs.google.com/spreadsheets/d/${data.settings.sheetId}` : "https://docs.google.com/spreadsheets"} target="_blank" rel="noreferrer"><Table2 size={20} /><span>Planilhas</span><ExternalLink size={14} /></a>
            </div>
          </section>
        </div>
      </>
    );
  }

  const viewContent = {
    dashboard: renderDashboard,
    contacts: renderContacts,
    tasks: renderTasks,
    flows: renderFlows,
    integrations: renderIntegrations,
  }[view];

  if (authLoading) return <AuthLoadingScreen />;
  if (!authUser) {
    return <GoogleLoginScreen error={error} busy={syncing} onLogin={() => void signInWithGoogle()} />;
  }

  return (
    <main className="app-frame">
      <aside className={`sidebar${menuOpen ? " is-open" : ""}`}>
        <div className="brand"><img src={LOGO_URL} alt="Kyro" /></div>
        <nav aria-label="Principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={view === item.id ? "is-active" : ""} type="button" title={item.label} aria-label={item.label} onClick={() => changeView(item.id)}><Icon size={20} /><span>{item.label}</span></button>;
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-status"><span className="online-dot" /><span>Agenda particular</span></div>
          <button className="sidebar-logout" type="button" onClick={() => void signOut()}><LogOut size={17} /><span>Sair</span></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="menu-button" type="button" aria-label="Abrir menu" title="Abrir menu" onClick={() => setMenuOpen((open) => !open)}><Menu size={20} /></button>
          <label className="search-field"><Search size={17} /><input type="search" placeholder="Buscar contato ou tarefa" value={search} onChange={(event) => { setSearch(event.target.value); if (event.target.value && view === "dashboard") setView("contacts"); }} /></label>
          <div className="topbar-tools">
            <a className="icon-button" href="https://mail.google.com" target="_blank" rel="noreferrer" title="Abrir Gmail" aria-label="Abrir Gmail"><Mail size={17} /></a>
            <a className="icon-button" href="https://calendar.google.com" target="_blank" rel="noreferrer" title="Abrir Google Agenda" aria-label="Abrir Google Agenda"><CalendarDays size={17} /></a>
            <button className={`google-button${google.connected ? " is-connected" : ""}`} type="button" onClick={() => google.connected ? changeView("integrations") : void connectGoogle()}><span className="google-mark">G</span><span>{google.connected ? "Conectado" : "Conectar"}</span></button>
          </div>
          <div className="profile">
            <span className="profile-avatar">{initials(authUser.name || authUser.email)}</span>
            <span className="profile-copy"><strong>{authUser.name}</strong><small>{authUser.email}</small></span>
            <button className="icon-button quiet" type="button" title="Sair" aria-label="Sair da agenda" onClick={() => void signOut()}><LogOut size={17} /></button>
          </div>
        </header>

        <div className="content-area">
          {error && <div className="error-banner" role="alert"><AlertTriangle size={18} /><span>{error}</span><button type="button" aria-label="Fechar aviso" title="Fechar aviso" onClick={() => setError("")}><X size={17} /></button></div>}
          {loading ? <LoadingState /> : viewContent()}
        </div>
      </section>

      {modal === "contact" && (
        <Modal title="Novo contato" icon={<UserRoundPlus />} onClose={() => setModal(null)}>
          <form className="modal-form" onSubmit={createContact}>
            <label>Nome<input name="name" required autoFocus placeholder="Nome completo" /></label>
            <label>Telefone<input name="phone" required inputMode="tel" placeholder="(00) 00000-0000" /></label>
            <label>Cidade<input name="city" placeholder="Ex.: Sao Paulo" /></label>
            <label>Nicho<input name="niche" placeholder="Ex.: Clinica, comercio, servicos" /></label>
            <label>Fluxo<select name="flowId" required defaultValue={data.flows[0]?.id}>{data.flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}</select></label>
            <div className="modal-actions"><button className="button text" type="button" onClick={() => setModal(null)}>Cancelar</button><button className="button primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} Salvar contato</button></div>
          </form>
        </Modal>
      )}

      {modal === "task" && (
        <Modal title="Nova tarefa" icon={<ListTodo />} onClose={() => setModal(null)}>
          <form className="modal-form two-columns" onSubmit={createTask}>
            <label className="full-field">Titulo<input name="title" required autoFocus placeholder="O que precisa ser feito?" /></label>
            <label>Contato<select name="contactId" defaultValue=""><option value="">Sem contato</option>{data.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label>
            <label>Fluxo<select name="flowId" defaultValue={data.flows[0]?.id}>{data.flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}</select></label>
            <label>Data<input name="dueDate" type="date" defaultValue={today} /></label>
            <label>Hora<input name="dueTime" type="time" defaultValue="09:00" /></label>
            <label>Prioridade<select name="priority" defaultValue="Media"><option>Baixa</option><option>Media</option><option>Alta</option></select></label>
            <label className="full-field">Observacoes<textarea name="notes" rows={3} placeholder="Detalhes opcionais" /></label>
            <label className={`switch-row full-field${!google.connected ? " is-disabled" : ""}`}><input name="syncCalendar" type="checkbox" disabled={!google.connected} defaultChecked={google.connected} /><span className="switch" /><span><strong>Google Agenda</strong><small>{google.connected ? "Criar evento automaticamente" : "Conecte o Google em Integracoes"}</small></span></label>
            <div className="modal-actions full-field"><button className="button text" type="button" onClick={() => setModal(null)}>Cancelar</button><button className="button primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} Salvar tarefa</button></div>
          </form>
        </Modal>
      )}

      {modal === "flow" && (
        <Modal title="Novo fluxo" icon={<Workflow />} onClose={() => setModal(null)}>
          <form className="modal-form" onSubmit={createFlow}>
            <label>Nome do fluxo<input name="name" required autoFocus placeholder="Ex.: Proposta enviada" /></label>
            <label>Cor<input className="color-input" name="color" type="color" defaultValue="#2a9d8f" /></label>
            <div className="modal-actions"><button className="button text" type="button" onClick={() => setModal(null)}>Cancelar</button><button className="button primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} Criar fluxo</button></div>
          </form>
        </Modal>
      )}

      <div className={`toast${toast ? " is-visible" : ""}`} role="status"><CircleCheckBig size={18} />{toast}</div>
      {(saving || syncing) && <div className="corner-loader" aria-label="Processando"><LoaderCircle className="spin" size={18} /></div>}
    </main>
  );
}

function GoogleLoginScreen({ error, busy, onLogin }: { error: string; busy: boolean; onLogin(): void }) {
  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand"><img src={LOGO_URL} alt="Kyro" /></div>
        <span className="login-kicker">Agenda particular</span>
        <h1>Entre na sua agenda</h1>
        <p>Use sua conta Google para acessar seus contatos e tarefas.</p>
        <button className="button google-login-button" type="button" onClick={onLogin} disabled={busy || !isSupabaseConfigured}>
          {busy ? <LoaderCircle className="spin" size={19} /> : <span className="google-mark">G</span>}
          Entrar com Google
        </button>
        {error && <div className="login-error"><AlertTriangle size={17} /> {error}</div>}
        <small className="login-privacy">Seus dados ficam separados e protegidos pela sua conta.</small>
      </section>
    </main>
  );
}

function AuthLoadingScreen() {
  return <main className="login-page"><div className="auth-loading"><LoaderCircle className="spin" size={24} /><span>Preparando sua agenda...</span></div></main>;
}

function Stat({ icon, value, label, tone }: { icon: ReactNode; value: number; label: string; tone: string }) {
  return <article className="stat-card"><span className={`stat-icon tone-${tone}`}>{icon}</span><span><strong>{value}</strong><small>{label}</small></span></article>;
}

function PanelHead({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <header className="panel-head"><span><strong>{title}</strong><small>{subtitle}</small></span>{action}</header>;
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><small>{text}</small></div>;
}

function Modal({ title, icon, onClose, children }: { title: string; icon: ReactNode; onClose(): void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header><span className="modal-title-icon">{icon}</span><h2>{title}</h2><button className="icon-button" type="button" onClick={onClose} title="Fechar" aria-label="Fechar"><X size={18} /></button></header>
        {children}
      </section>
    </div>
  );
}

function IntegrationRow({ icon, tone, title, detail, action, onClick, disabled }: { icon: ReactNode; tone: string; title: string; detail: string; action: string; onClick(): void; disabled: boolean }) {
  return <article className="integration-row"><span className={`integration-icon tone-${tone}`}>{icon}</span><span><strong>{title}</strong><small>{detail}</small></span><button className="button secondary" type="button" onClick={onClick} disabled={disabled}>{action}</button></article>;
}

function LoadingState() {
  return <div className="loading-state"><div className="loading-heading" /><div className="loading-stats">{Array.from({ length: 4 }, (_, index) => <span key={index} />)}</div><div className="loading-panels"><span /><span /></div></div>;
}
