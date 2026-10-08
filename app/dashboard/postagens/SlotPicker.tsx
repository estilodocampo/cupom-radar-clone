'use client';

export type Slot = 'wa1' | 'wa2';

export function SlotPicker({ slot, setSlot, phones }: { slot: Slot; setSlot: (s: Slot) => void; phones: Record<string, string | undefined> }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
      {(['wa1', 'wa2'] as Slot[]).map((s, i) => (
        <button
          key={s}
          type="button"
          className={`tab${slot === s ? ' active' : ''}`}
          onClick={() => setSlot(s)}
        >
          📱 {i + 1}{phones[s] ? ` (${phones[s]})` : ''}
        </button>
      ))}
    </div>
  );
}
