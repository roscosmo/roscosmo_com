// One queue owns Python. Never overlap requests or revisions.
let python, queue = Promise.resolve();
async function execute(message) {
  if (message.kind === 'init') {
    if (python) throw Error('Already initialized');
    const manifest = await (await fetch('./manifest.json')).json();
    const { loadPyodide } = await import(manifest.runtime + 'pyodide.mjs');
    python = await loadPyodide({ indexURL: manifest.runtime });
    await python.loadPackage(['pillow', 'jsonschema']);
    python.unpackArchive(await (await fetch('./backend.zip')).arrayBuffer(), 'zip', { extractDir: '/backend' });
    python.FS.writeFile('/debugger_scenarios.py', await (await fetch('./debugger_scenarios.py')).text());
    python.FS.writeFile('/scenarios.py', await (await fetch('./scenarios.py')).text());
    await python.runPythonAsync("import sys\nsys.path.insert(0, '/backend/tools/authoring')\nsys.path.insert(0, '/')");
    await python.runPythonAsync(await (await fetch('./bridge.py')).text());
    const versions = JSON.parse(python.runPython("__import__('json').dumps({n: __import__('importlib.metadata', fromlist=['version']).version(n) for n in ['Pillow','jsonschema','referencing','rpds-py']})"));
    return { manifest, versions, pyodide: python.version };
  }
  if (!python) throw Error('Initialize first');
  const names = {rpc: 'dispatch', import: 'import_project', export: 'export_project', qualify: 'qualify_json', debugger: 'qualify_debugger_json'};
  if (!names[message.kind]) throw Error('Unknown worker operation');
  const fn = python.globals.get(names[message.kind]);
  try {
    const result = fn(message.kind === 'rpc' ? JSON.stringify(message.request) : message.data);
    return ['rpc', 'qualify', 'debugger'].includes(message.kind) ? JSON.parse(result) : result;
  } finally { fn.destroy(); }
}
self.onmessage = ({data}) => {
  queue = queue.then(async () => {
    try { self.postMessage({id: data.id, result: await execute(data)}); }
    catch (error) { self.postMessage({id: data.id, error: String(error)}); }
  });
};
