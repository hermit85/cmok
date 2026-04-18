import { AddPairScreen } from '../src/screens/AddPairScreen';

/**
 * Add-pair route — lets a caregiver invite an additional signaler beyond
 * their first care-pair. Self-contained flow (name → code → share) to
 * avoid conflicts with useRelationship's "prefer active" sort which
 * would otherwise hide the freshly-created pending row.
 */
export default function AddPair() {
  return <AddPairScreen />;
}
