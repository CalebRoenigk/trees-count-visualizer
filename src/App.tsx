import { useEffect, useMemo, useState } from 'react';
import { ColorModeToggle } from './components/ColorModeToggle';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Legend } from './components/Legend';
import { MapView, type ColorMode } from './components/MapView';
import { PlaybackControls } from './components/PlaybackControls';
import { TimelineScrubber } from './components/TimelineScrubber';
import { TreeDetailPanel } from './components/TreeDetailPanel';
import { assignSpeciesColors, speciesEntriesFor } from './data/colors';
import { loadTrees } from './data/loadTrees';
import type { Tree } from './data/types';
import { useTimelineEngine } from './hooks/useTimelineEngine';
import styles from './App.module.css';

function formatDate(ms: number): string {
  const d = new Date(ms);
  const day = d.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${month} ${day}${suffix} ${d.getFullYear()}`;
}

function App() {
  const [trees, setTrees] = useState<Tree[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>('health');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [viewportTreeIds, setViewportTreeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadTrees()
      .then(setTrees)
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, []);

  const engine = useTimelineEngine(trees ?? []);
  const speciesColors = useMemo(() => assignSpeciesColors(trees ?? []), [trees]);
  const visibleIds = useMemo(() => new Set(engine.visibleTrees.map((t) => t.id)), [engine.visibleTrees]);
  const activeGroupBounds = engine.groups[engine.activeGroupIndex]?.bounds ?? null;

  // Reported by MapView from the map's actual rendered bounds (not just
  // the active group's bounds — camera padding and nearby-but-different
  // -session clusters can put more on screen than that), so the "Tree
  // Type" legend reflects exactly what's currently visible on the map.
  const treesInView = useMemo(
    () => (trees ?? []).filter((t) => viewportTreeIds.has(t.id)),
    [trees, viewportTreeIds],
  );
  const speciesInView = useMemo(
    () => speciesEntriesFor(treesInView, speciesColors),
    [treesInView, speciesColors],
  );

  const selectedId = pinnedId ?? hoveredId;
  const selectedTree = useMemo(
    () => (trees ?? []).find((t) => t.id === selectedId) ?? null,
    [trees, selectedId],
  );

  const handleClickTree = (id: string | null) => {
    setPinnedId((prev) => (id === null ? null : prev === id ? null : id));
  };

  return (
    <div className={styles.app}>
      <MapView
        trees={engine.timedTrees}
        visibleIds={visibleIds}
        colorMode={colorMode}
        speciesColors={speciesColors}
        newlyPoppedIds={engine.newlyPoppedIds}
        activeGroupBounds={activeGroupBounds}
        hoveredId={hoveredId}
        pinnedId={pinnedId}
        onHoverTree={setHoveredId}
        onClickTree={handleClickTree}
        onViewportTreesChange={setViewportTreeIds}
      />

      <div className={styles.vignette} />
      <div className={styles.bottomScrim} />

      <div className={styles.overlay}>
        <div className={styles.topRow}>
          <Header />
          <TreeDetailPanel tree={selectedTree} />
        </div>

        <div className={styles.bottomStack}>
          <div className={styles.infoRow}>
            <div className={styles.locationBlock}>
              <div className={styles.locationName}>{engine.currentLocationLabel}</div>
              <div className={styles.locationDate}>
                {trees && trees.length > 0 ? formatDate(engine.cursorMs) : ''}
              </div>
            </div>
            <div className={styles.sideStack}>
              <ColorModeToggle mode={colorMode} onChange={setColorMode} />
              <Legend
                mode={colorMode}
                speciesEntries={speciesInView.entries}
                hasOtherSpecies={speciesInView.hasOther}
              />
            </div>
          </div>

          <TimelineScrubber
            axis={engine.axis}
            groups={engine.groups}
            activeGroupIndex={engine.activeGroupIndex}
            cursorX={engine.cursorX}
            onSeek={engine.seekTo}
          />

          <PlaybackControls
            isPlaying={engine.isPlaying}
            onTogglePlay={engine.togglePlay}
            onPrevGroup={engine.goToPrevGroup}
            onNextGroup={engine.goToNextGroup}
            sliderPos={engine.sliderPos}
            onSliderPosChange={engine.setSliderPos}
            speed={engine.speed}
          />

          <Footer />
        </div>
      </div>

      {loadError && (
        <div className={styles.errorBanner}>Failed to load tree data: {loadError}</div>
      )}
    </div>
  );
}

export default App;
