import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, dateFnsLocalizer, View, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './hrCalendar.css';
import { hrCalendarApi } from '../../api/hrCalendar';
import { payrollApi } from '../../api/payroll';
import { useToast } from '../../components/ui/Toast';

const locales = { es };
const localizer = dateFnsLocalizer({
  format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay, locales,
});
const DnDCalendar = withDragAndDrop(Calendar);

const inputCls = 'w-full bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-xs text-surface-500 mb-1';

const EMPLOYEE_PALETTE = ['#00B8E0', '#7C3AED', '#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#EC4899', '#84CC16', '#14B8A6', '#F97316'];
const colorForEmployee = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return EMPLOYEE_PALETTE[hash % EMPLOYEE_PALETTE.length];
};

const LEAVE_TYPES = [
  { value: 'VACACIONES', label: 'Vacaciones' },
  { value: 'ENFERMEDAD', label: 'Enfermedad' },
  { value: 'PERSONAL', label: 'Personal' },
  { value: 'CALAMIDAD_DOMESTICA', label: 'Calamidad doméstica' },
  { value: 'PERMISO_NO_REMUNERADO', label: 'Permiso no remunerado' },
  { value: 'OTRO', label: 'Otro' },
];

const LEAVE_STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDIENTE_JEFATURA: { label: 'Pendiente jefatura', cls: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' },
  PENDIENTE_TTHH: { label: 'Pendiente TTHH', cls: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300' },
  APROBADO: { label: 'Aprobado', cls: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300' },
  RECHAZADO: { label: 'Rechazado', cls: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300' },
  CANCELADO: { label: 'Cancelado', cls: 'bg-surface-100 dark:bg-surface-700 text-surface-500' },
};

function timeOn(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

interface CalEvent {
  id: string;
  type: 'shift' | 'attendance' | 'leave';
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  color: string;
  resource: any;
}

export default function HrCalendarPage() {
  const toast = useToast();
  const [range, setRange] = useState(() => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }));
  const [view, setView] = useState<View>(Views.MONTH);
  const [data, setData] = useState<{ shifts: any[]; attendance: any[]; leaves: any[]; canManage: boolean }>({ shifts: [], attendance: [], leaves: [], canManage: false });
  const [employees, setEmployees] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeFilter, setEmployeeFilter] = useState('');

  const [shiftModal, setShiftModal] = useState<null | { mode: 'create' | 'edit'; date?: Date; shift?: any }>(null);
  const [templateManager, setTemplateManager] = useState(false);
  const [leaveModal, setLeaveModal] = useState(false);
  const [approvals, setApprovals] = useState<{ mine: any[]; team: any[]; hr: any[] }>({ mine: [], team: [], hr: [] });
  const [showApprovals, setShowApprovals] = useState(false);

  const canManage = data.canManage;

  const load = useCallback(() => {
    setLoading(true);
    const from = range.from.toISOString().slice(0, 10);
    const to = addDays(range.to, 1).toISOString().slice(0, 10);
    hrCalendarApi.getCalendar(from, to, employeeFilter || undefined)
      .then((r) => setData(r.data))
      .catch(() => toast.error('Error al cargar el calendario'))
      .finally(() => setLoading(false));
  }, [range, employeeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    payrollApi.getEmployees().then((r) => setEmployees(r.data)).catch(() => {});
    hrCalendarApi.getShiftTemplates().then((r) => setTemplates(r.data)).catch(() => {});
  }, []);

  const loadApprovals = useCallback(() => {
    Promise.all([
      hrCalendarApi.getLeaveRequests({ scope: 'mine' }),
      hrCalendarApi.getLeaveRequests({ scope: 'team', status: 'PENDIENTE_JEFATURA' }),
      hrCalendarApi.getLeaveRequests({ status: 'PENDIENTE_TTHH' }),
    ]).then(([mine, team, hr]) => setApprovals({ mine: mine.data, team: team.data, hr: canManage ? hr.data : [] }))
      .catch(() => {});
  }, [canManage]);

  useEffect(() => { loadApprovals(); }, [loadApprovals]);

  const events: CalEvent[] = useMemo(() => {
    const list: CalEvent[] = [];
    for (const s of data.shifts) {
      if (s.status === 'CANCELLED') continue;
      const empName = `${s.employee.firstName} ${s.employee.lastName}`;
      list.push({
        id: `shift-${s.id}`, type: 'shift',
        title: `🕐 ${empName} · ${s.startTime}-${s.endTime}`,
        start: timeOn(new Date(s.date), s.startTime), end: timeOn(new Date(s.date), s.endTime),
        color: s.shiftTemplate?.color || colorForEmployee(s.employeeId),
        resource: s,
      });
    }
    for (const a of data.attendance) {
      const empName = `${a.employee.firstName} ${a.employee.lastName}`;
      list.push({
        id: `att-${a.id}`, type: 'attendance',
        title: `✅ ${empName} · marcó ${Number(a.hoursWorked).toFixed(1)}h`,
        start: new Date(a.checkIn), end: new Date(a.checkOut),
        color: '#10B981',
        resource: a,
      });
    }
    for (const l of data.leaves) {
      const empName = `${l.employee.firstName} ${l.employee.lastName}`;
      const meta = LEAVE_STATUS_META[l.status];
      list.push({
        id: `leave-${l.id}`, type: 'leave', allDay: true,
        title: `📆 ${empName} · ${LEAVE_TYPES.find((t) => t.value === l.type)?.label ?? l.type} (${meta?.label ?? l.status})`,
        start: new Date(l.startDate), end: addDays(new Date(l.endDate), 1),
        color: l.status === 'APROBADO' ? '#22C55E' : '#F59E0B',
        resource: l,
      });
    }
    return list;
  }, [data]);

  const eventPropGetter = (event: CalEvent) => ({
    style: { backgroundColor: event.color, opacity: event.type === 'attendance' ? 0.85 : 1 },
    className: event.type === 'leave' ? 'kp-event-leave' : undefined,
  });

  const onRangeChange = (r: any) => {
    if (Array.isArray(r)) {
      setRange({ from: r[0], to: r[r.length - 1] });
    } else if (r?.start && r?.end) {
      setRange({ from: r.start, to: r.end });
    }
  };

  const onSelectSlot = (slot: { start: Date }) => {
    if (!canManage) return;
    setShiftModal({ mode: 'create', date: slot.start });
  };

  const onSelectEvent = (event: CalEvent) => {
    if (event.type === 'shift' && canManage) setShiftModal({ mode: 'edit', shift: event.resource });
  };

  const onEventDrop = async ({ event, start }: any) => {
    if (event.type !== 'shift' || !canManage) return;
    try {
      await hrCalendarApi.rescheduleShift(event.resource.id, { date: new Date(start).toISOString().slice(0, 10) });
      toast.success('Turno reprogramado');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo reprogramar el turno');
    }
  };

  const draggableAccessor = (event: CalEvent) => event.type === 'shift' && canManage;

  return (
    <div className="max-w-7xl">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-xl">🗓️</div>
          <div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Calendario de TTHH</h1>
            <p className="text-sm text-surface-500">
              {canManage ? 'Turnos, biométrico y solicitudes de permiso de todos los colaboradores' : 'Tu turno, tu asistencia y tus solicitudes de permiso'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {canManage && (
            <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={`${inputCls} w-auto`}>
              <option value="">Todos los colaboradores</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
          )}
          <button onClick={() => setShowApprovals((v) => !v)} className="relative text-sm px-4 py-2 border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700">
            📋 Aprobaciones
            {(approvals.team.length + approvals.hr.length) > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{approvals.team.length + approvals.hr.length}</span>
            )}
          </button>
          {canManage && (
            <button onClick={() => setTemplateManager(true)} className="text-sm px-4 py-2 border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700">
              🎨 Plantillas de turno
            </button>
          )}
          <button onClick={() => setLeaveModal(true)} className="text-sm px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium">
            + Solicitar permiso
          </button>
          <Link to="/nomina/asistencia" className="text-sm px-4 py-2 border border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-300 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700">🕐 Asistencia</Link>
        </div>
      </div>

      {showApprovals && (
        <ApprovalsPanel
          approvals={approvals}
          onDecided={() => { loadApprovals(); load(); }}
          onClose={() => setShowApprovals(false)}
        />
      )}

      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4 kp-calendar-wrap" style={{ height: 720 }}>
        {loading && <div className="flex justify-center py-14"><div className="animate-spin w-7 h-7 border-4 border-brand-500 border-t-transparent rounded-full" /></div>}
        <DnDCalendar
          localizer={localizer}
          events={events as any}
          view={view}
          onView={setView}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          date={range.from}
          onNavigate={(d) => setRange((r) => ({ ...r, from: d }))}
          onRangeChange={onRangeChange}
          style={{ height: loading ? 0 : '100%', visibility: loading ? 'hidden' : 'visible' }}
          selectable={canManage}
          onSelectSlot={onSelectSlot}
          onSelectEvent={onSelectEvent as any}
          onEventDrop={onEventDrop}
          draggableAccessor={draggableAccessor as any}
          resizable={false}
          eventPropGetter={eventPropGetter as any}
          culture="es"
          messages={{
            month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda', today: 'Hoy',
            previous: 'Atrás', next: 'Siguiente', noEventsInRange: 'Sin eventos en este rango', date: 'Fecha', time: 'Hora', event: 'Evento',
          }}
        />
      </div>

      {shiftModal && (
        <ShiftModal
          modal={shiftModal}
          employees={employees}
          templates={templates}
          onClose={() => setShiftModal(null)}
          onSaved={() => { setShiftModal(null); load(); }}
        />
      )}
      {templateManager && (
        <TemplateManagerModal
          templates={templates}
          onClose={() => setTemplateManager(false)}
          onChanged={(t) => setTemplates(t)}
        />
      )}
      {leaveModal && (
        <LeaveRequestModal onClose={() => setLeaveModal(false)} onSaved={() => { setLeaveModal(false); loadApprovals(); load(); }} />
      )}
    </div>
  );
}

// ── Modal: asignar / reprogramar turno ──
function ShiftModal({ modal, employees, templates, onClose, onSaved }: {
  modal: { mode: 'create' | 'edit'; date?: Date; shift?: any };
  employees: any[]; templates: any[];
  onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = modal.mode === 'edit';
  const shift = modal.shift;
  const [employeeId, setEmployeeId] = useState(shift?.employeeId || '');
  const [date, setDate] = useState((shift ? new Date(shift.date) : modal.date || new Date()).toISOString().slice(0, 10));
  const [shiftTemplateId, setShiftTemplateId] = useState(shift?.shiftTemplateId || '');
  const [startTime, setStartTime] = useState(shift?.startTime || '08:00');
  const [endTime, setEndTime] = useState(shift?.endTime || '17:00');
  const [notes, setNotes] = useState(shift?.notes || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (shiftTemplateId) {
      const t = templates.find((x) => x.id === shiftTemplateId);
      if (t) { setStartTime(t.startTime); setEndTime(t.endTime); }
    }
  }, [shiftTemplateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!isEdit && !employeeId) { toast.error('Selecciona un colaborador'); return; }
    setBusy(true);
    try {
      if (isEdit) {
        await hrCalendarApi.rescheduleShift(shift.id, { date, startTime, endTime, notes });
        toast.success('Turno actualizado');
      } else {
        await hrCalendarApi.assignShift({ employeeId, date, shiftTemplateId: shiftTemplateId || undefined, startTime, endTime, notes });
        toast.success('Turno asignado');
      }
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo guardar el turno');
    } finally { setBusy(false); }
  };

  const cancelShift = async () => {
    if (!isEdit) return;
    setBusy(true);
    try {
      await hrCalendarApi.cancelShift(shift.id);
      toast.success('Turno cancelado');
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo cancelar');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-card p-5 w-full max-w-md space-y-3 max-h-[85vh] overflow-y-auto">
        <h3 className="font-semibold text-surface-900 dark:text-white">{isEdit ? 'Reprogramar turno' : 'Asignar turno'}</h3>
        {!isEdit && (
          <div>
            <label className={labelCls}>Colaborador *</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputCls}>
              <option value="">Selecciona…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
          </div>
        )}
        <div><label className={labelCls}>Día *</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></div>
        <div>
          <label className={labelCls}>Plantilla de turno</label>
          <select value={shiftTemplateId} onChange={(e) => setShiftTemplateId(e.target.value)} className={inputCls}>
            <option value="">Horario manual</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.startTime}-{t.endTime})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Entrada *</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Salida *</label><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>Notas</label><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} /></div>
        <div className="flex justify-between gap-2 pt-2">
          {isEdit ? <button onClick={cancelShift} disabled={busy} className="px-4 py-2 text-sm border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg">Cancelar turno</button> : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-surface-300 dark:border-surface-600 rounded-lg text-surface-600 dark:text-surface-300">Cerrar</button>
            <button onClick={save} disabled={busy} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">{busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal: administrar plantillas de turno ──
function TemplateManagerModal({ templates, onClose, onChanged }: { templates: any[]; onClose: () => void; onChanged: (t: any[]) => void }) {
  const toast = useToast();
  const [list, setList] = useState(templates);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [color, setColor] = useState('#00B8E0');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const r = await hrCalendarApi.getShiftTemplates();
    setList(r.data); onChanged(r.data);
  };

  const add = async () => {
    if (!name.trim()) { toast.error('Nombre requerido'); return; }
    setBusy(true);
    try {
      await hrCalendarApi.createShiftTemplate({ name, startTime, endTime, breakMinutes, color });
      toast.success('Plantilla creada');
      setName('');
      await refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo crear la plantilla');
    } finally { setBusy(false); }
  };

  const toggle = async (t: any) => {
    try {
      await hrCalendarApi.updateShiftTemplate(t.id, { isActive: !t.isActive });
      await refresh();
    } catch { toast.error('No se pudo actualizar'); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-card p-5 w-full max-w-lg space-y-4 max-h-[85vh] overflow-y-auto">
        <h3 className="font-semibold text-surface-900 dark:text-white">Plantillas de turno</h3>
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {list.length === 0 && <p className="text-sm text-surface-400">Sin plantillas aún.</p>}
          {list.map((t) => (
            <div key={t.id} className={`flex items-center justify-between border border-surface-200 dark:border-surface-700 rounded-lg px-3 py-2 ${!t.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color || '#00B8E0' }} />
                <span className="text-sm text-surface-800 dark:text-white">{t.name}</span>
                <span className="text-xs text-surface-400">{t.startTime}-{t.endTime}</span>
              </div>
              <button onClick={() => toggle(t)} className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300">{t.isActive ? 'Desactivar' : 'Reactivar'}</button>
            </div>
          ))}
        </div>
        <div className="border-t border-surface-200 dark:border-surface-700 pt-3 grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className={labelCls}>Nombre *</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ej. Turno mañana" /></div>
          <div><label className={labelCls}>Entrada</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Salida</label><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Almuerzo (min)</label><input type="number" min={0} value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value))} className={inputCls} /></div>
          <div><label className={labelCls}>Color</label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className={`${inputCls} h-10 p-1`} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-surface-300 dark:border-surface-600 rounded-lg text-surface-600 dark:text-surface-300">Cerrar</button>
          <button onClick={add} disabled={busy} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">{busy ? 'Creando…' : '+ Agregar plantilla'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: solicitar permiso ──
function LeaveRequestModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [type, setType] = useState('VACACIONES');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason.trim()) { toast.error('Describe el motivo'); return; }
    setBusy(true);
    try {
      await hrCalendarApi.createLeaveRequest({ type, startDate, endDate, reason });
      toast.success('Solicitud enviada');
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo enviar la solicitud');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-card p-5 w-full max-w-md space-y-3 max-h-[85vh] overflow-y-auto">
        <h3 className="font-semibold text-surface-900 dark:text-white">Solicitar permiso</h3>
        <div>
          <label className={labelCls}>Tipo *</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Desde *</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Hasta *</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} /></div>
        </div>
        <div><label htmlFor="leave-reason" className={labelCls}>Motivo *</label><textarea id="leave-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputCls} /></div>
        <p className="text-xs text-surface-400">Tu solicitud pasará por la aprobación de tu jefatura directa (si tienes una asignada) y luego de Talento Humano.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-surface-300 dark:border-surface-600 rounded-lg text-surface-600 dark:text-surface-300">Cancelar</button>
          <button onClick={submit} disabled={busy} className="px-4 py-2 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium">{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Panel: mis solicitudes + aprobaciones pendientes (jefatura / TTHH) ──
function ApprovalsPanel({ approvals, onDecided, onClose }: {
  approvals: { mine: any[]; team: any[]; hr: any[] }; onDecided: () => void; onClose: () => void;
}) {
  const toast = useToast();
  const [busyId, setBusyId] = useState('');

  const decide = async (id: string, kind: 'manager' | 'hr', decision: 'APPROVE' | 'REJECT') => {
    setBusyId(id);
    try {
      if (kind === 'manager') await hrCalendarApi.managerDecision(id, decision);
      else await hrCalendarApi.hrDecision(id, decision);
      toast.success(decision === 'APPROVE' ? 'Solicitud aprobada' : 'Solicitud rechazada');
      onDecided();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo procesar la decisión');
    } finally { setBusyId(''); }
  };

  const cancel = async (id: string) => {
    setBusyId(id);
    try {
      await hrCalendarApi.cancelLeaveRequest(id);
      toast.success('Solicitud cancelada');
      onDecided();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'No se pudo cancelar');
    } finally { setBusyId(''); }
  };

  const Row = ({ l, actions }: { l: any; actions?: React.ReactNode }) => {
    const meta = LEAVE_STATUS_META[l.status] ?? { label: l.status, cls: '' };
    return (
      <div className="flex items-center justify-between gap-3 border-b border-surface-100 dark:border-surface-700 py-2 last:border-0">
        <div>
          <p className="text-sm text-surface-800 dark:text-white">{l.employee.firstName} {l.employee.lastName} · {LEAVE_TYPES.find((t) => t.value === l.type)?.label ?? l.type}</p>
          <p className="text-xs text-surface-400">{new Date(l.startDate).toLocaleDateString('es', { timeZone: 'UTC' })} – {new Date(l.endDate).toLocaleDateString('es', { timeZone: 'UTC' })} · {l.reason}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>{meta.label}</span>
          {actions}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-soft p-4 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-surface-900 dark:text-white">Solicitudes de permiso</h3>
        <button onClick={onClose} className="text-surface-400 hover:text-surface-600">✕</button>
      </div>

      {approvals.hr.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-surface-500 uppercase mb-1">Pendientes de TTHH</p>
          {approvals.hr.map((l) => (
            <Row key={l.id} l={l} actions={
              <>
                <button disabled={busyId === l.id} onClick={() => decide(l.id, 'hr', 'APPROVE')} className="text-xs px-2 py-1 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300">Aprobar</button>
                <button disabled={busyId === l.id} onClick={() => decide(l.id, 'hr', 'REJECT')} className="text-xs px-2 py-1 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300">Rechazar</button>
              </>
            } />
          ))}
        </div>
      )}

      {approvals.team.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-surface-500 uppercase mb-1">Pendientes de tu aprobación (tu equipo)</p>
          {approvals.team.map((l) => (
            <Row key={l.id} l={l} actions={
              <>
                <button disabled={busyId === l.id} onClick={() => decide(l.id, 'manager', 'APPROVE')} className="text-xs px-2 py-1 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300">Aprobar</button>
                <button disabled={busyId === l.id} onClick={() => decide(l.id, 'manager', 'REJECT')} className="text-xs px-2 py-1 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300">Rechazar</button>
              </>
            } />
          ))}
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-surface-500 uppercase mb-1">Mis solicitudes</p>
        {approvals.mine.length === 0 && <p className="text-sm text-surface-400">Aún no has enviado solicitudes.</p>}
        {approvals.mine.map((l) => (
          <Row key={l.id} l={l} actions={
            (l.status === 'PENDIENTE_JEFATURA' || l.status === 'PENDIENTE_TTHH') ? (
              <button disabled={busyId === l.id} onClick={() => cancel(l.id)} className="text-xs px-2 py-1 rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300">Cancelar</button>
            ) : undefined
          } />
        ))}
      </div>
    </div>
  );
}
