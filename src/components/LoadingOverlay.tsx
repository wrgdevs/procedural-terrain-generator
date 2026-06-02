type Props = {
  visible: boolean;
  label: string;
};

export function LoadingOverlay({ visible, label }: Props) {
  if (!visible) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-card">
        <div className="loading-spinner" />
        <div>
          <h2>{label}</h2>
          <p>Please wait while the terrain updates.</p>
        </div>
      </div>
    </div>
  );
}