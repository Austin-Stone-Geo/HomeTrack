import { useState } from 'react';

import { Button } from '@/components/screen';

/**
 * A delete-style button that asks for a second tap instead of a pop-up,
 * so it works the same on phones and the web.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  small,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  small?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!armed)
    return <Button small={small} kind="danger" label={label} onPress={() => setArmed(true)} />;
  return (
    <>
      <Button
        small={small}
        kind="danger"
        label={confirmLabel}
        busy={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setArmed(false);
          }
        }}
      />
      <Button small={small} kind="quiet" label="Keep it" onPress={() => setArmed(false)} />
    </>
  );
}
