// Only imported in environment w/ `window`
// So we need to mock these for tests
import Mousetrap from 'mousetrap';
import pausePlugin from './pausePlugin';
import recordPlugin from './recordPlugin';

Mousetrap.pause = pausePlugin;

// Initialize record plugin
// https://github.com/ccampbell/mousetrap/blob/master/plugins/record/mousetrap-record.js#L189-L201
//
// Adds: .record(callback)
// Adds: .handleKey()
recordPlugin(Mousetrap);

export default Mousetrap;
