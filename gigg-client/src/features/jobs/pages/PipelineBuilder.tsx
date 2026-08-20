import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Image as ImageIcon, CheckSquare, FileText } from 'lucide-react';
import { AppHeader } from '../../../components/layout/Navigation';
import { Button, Input, Textarea, TimeInput } from '../../../components/ui';
import { usePipelineStore, type TaskDraft } from '../../../store/pipelineStore';
import { useUIStore } from '../../../store/uiStore';

const COMPLETION_TYPES: { value: TaskDraft['completionType']; label: string; icon: React.ReactNode }[] = [
  { value: 'tick', label: 'Tick only', icon: <CheckSquare size={16} /> },
  { value: 'image', label: 'Image', icon: <ImageIcon size={16} /> },
  { value: 'form', label: 'Form', icon: <FileText size={16} /> },
];

function emptyTask(kind: TaskDraft['kind']): TaskDraft {
  if (kind === 'opening') {
    return {
      kind,
      title: 'Confirm Arrival',
      description: 'Upload a photo showing you have arrived at the venue.',
      completionType: 'image',
      responseWindowMinutes: 5,
      autoFailMinutes: 10,
      openMinutesBefore: 10,
      openMinutesAfter: 10,
      requiresReview: true,
    };
  }
  if (kind === 'closing') {
    return {
      kind,
      title: 'Confirm Checkout',
      description: 'Upload a photo before you leave the venue.',
      completionType: 'image',
      responseWindowMinutes: 5,
      autoFailMinutes: 10,
      openMinutesBefore: 10,
      openMinutesAfter: 10,
      requiresReview: true,
    };
  }
  return {
    kind,
    title: '',
    description: '',
    completionType: 'tick',
    responseWindowMinutes: 5,
    autoFailMinutes: 10,
    openMinutesBefore: 10,
    openMinutesAfter: 10,
    anchorTime: undefined,
    requiresReview: true,
  };
}

export default function PipelineBuilder() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { saveJobTasks } = usePipelineStore();
  const { addToast } = useUIStore();

  const [tasks, setTasks] = useState<TaskDraft[]>([emptyTask('opening'), emptyTask('closing')]);
  const [submitting, setSubmitting] = useState(false);

  const middleTasks = tasks.filter((t) => t.kind === 'task');
  const openingIndex = tasks.findIndex((t) => t.kind === 'opening');

  const updateTask = (index: number, updates: Partial<TaskDraft>) => {
    setTasks((prev) => prev.map((t, i) => (i === index ? { ...t, ...updates } : t)));
  };

  const addMiddleTask = () => {
    setTasks((prev) => {
      const insertAt = prev.findIndex((t) => t.kind === 'closing');
      const next = [...prev];
      next.splice(insertAt, 0, emptyTask('task'));
      return next;
    });
  };

  const removeTask = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!jobId) return;
    if (tasks.some((t) => !t.title.trim())) {
      addToast('Please give every task a title', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await saveJobTasks(jobId, tasks);
      addToast('Pipeline saved! Job is ready.', 'success');
      navigate('/jobs?tab=postings');
    } catch (err: any) {
      addToast(err?.message || 'Failed to save pipeline', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderTask = (task: TaskDraft, index: number) => {
    const isFixed = task.kind === 'opening' || task.kind === 'closing';
    const anchorLabel = task.kind === 'opening' ? 'job reporting time' : task.kind === 'closing' ? 'job end time' : null;
    const isMiddleClockAnchored = task.kind === 'task' && task.anchorTime !== undefined;

    return (
      <div key={index} className="bg-white dark:bg-dark-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-dark-700 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-primary-600 dark:text-primary-400">
            {task.kind === 'opening' ? 'Opening Task' : task.kind === 'closing' ? 'Closing Task' : `Task ${middleTasks.indexOf(task) + 1}`}
          </span>
          {!isFixed && (
            <button onClick={() => removeTask(index)} className="text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <Input
          placeholder="Task title"
          value={task.title}
          onChange={(e) => updateTask(index, { title: e.target.value })}
        />
        <Textarea
          placeholder="Description (optional)"
          rows={2}
          value={task.description}
          onChange={(e) => updateTask(index, { description: e.target.value })}
        />

        <div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">Need:</p>
          <div className="flex gap-2">
            {COMPLETION_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => updateTask(index, { completionType: ct.value })}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  task.completionType === ct.value
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-slate-50 dark:bg-dark-700 text-slate-500 border-slate-200 dark:border-dark-600'
                }`}
              >
                {ct.icon}
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        {anchorLabel ? (
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">
              Window is timed to the {anchorLabel}, not to when the worker opens the app.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Opens (min before)"
                type="number"
                min="0"
                value={task.openMinutesBefore}
                onChange={(e) => updateTask(index, { openMinutesBefore: Number(e.target.value) || 0 })}
              />
              <Input
                label="Auto-fail (min after)"
                type="number"
                min="0"
                value={task.openMinutesAfter}
                onChange={(e) => updateTask(index, { openMinutesAfter: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => updateTask(index, { anchorTime: isMiddleClockAnchored ? undefined : '12:00' })}
              className="flex items-center gap-2 text-xs font-bold text-primary-600 dark:text-primary-400 self-start"
            >
              <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isMiddleClockAnchored ? 'bg-primary-500 border-primary-500' : 'border-slate-300 dark:border-dark-500'}`}>
                {isMiddleClockAnchored && <span className="w-1.5 h-1.5 bg-white rounded-sm" />}
              </span>
              Anchor this task to a specific time
            </button>

            {isMiddleClockAnchored ? (
              <>
                <TimeInput
                  label="At"
                  value={task.anchorTime}
                  onChange={(v) => updateTask(index, { anchorTime: v })}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium -mt-1">
                  Window is timed to this clock time (on the job's date), not to when the previous task finishes.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Opens (min before)"
                    type="number"
                    min="0"
                    value={task.openMinutesBefore}
                    onChange={(e) => updateTask(index, { openMinutesBefore: Number(e.target.value) || 0 })}
                  />
                  <Input
                    label="Auto-fail (min after)"
                    type="number"
                    min="0"
                    value={task.openMinutesAfter}
                    onChange={(e) => updateTask(index, { openMinutesAfter: Number(e.target.value) || 0 })}
                  />
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Response window (min)"
                  type="number"
                  min="1"
                  value={task.responseWindowMinutes}
                  onChange={(e) => updateTask(index, { responseWindowMinutes: Number(e.target.value) || 5 })}
                />
                <Input
                  label="Auto-fail after (min)"
                  type="number"
                  min="1"
                  value={task.autoFailMinutes}
                  onChange={(e) => updateTask(index, { autoFailMinutes: Number(e.target.value) || 10 })}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="pb-32 font-sans bg-slate-50 dark:bg-dark-900 min-h-screen">
      <AppHeader title="Build Job Pipeline" showBack onBack={() => navigate(-1)} />

      <div className="px-5 pt-6 flex flex-col gap-4">
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Define the tasks a worker must complete for this job, from check-in to sign-off.
        </p>

        {tasks.slice(0, openingIndex + 1).map((task, index) => renderTask(task, index))}

        <button
          onClick={addMiddleTask}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-slate-300 dark:border-dark-600 text-slate-500 dark:text-slate-400 font-bold text-sm hover:border-primary-400 hover:text-primary-500 transition-colors"
        >
          <Plus size={18} /> Add Task
        </button>

        {tasks.slice(openingIndex + 1).map((task, i) => renderTask(task, openingIndex + 1 + i))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-dark-800/90 backdrop-blur-md border-t border-slate-100 dark:border-dark-600 z-40 max-w-lg mx-auto">
        <Button fullWidth size="lg" loading={submitting} onClick={handleSubmit}>
          Submit
        </Button>
      </div>
    </div>
  );
}
