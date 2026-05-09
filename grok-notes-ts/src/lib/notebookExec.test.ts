import { execNotebookCell } from './notebookExec';

describe('execNotebookCell', () => {
  it('runs code with Math', () => {
    const r = execNotebookCell({ type: 'code', content: 'return Math.PI;' });
    expect(r.isError).toBe(false);
    expect(r.lastPlain).toContain('3.14');
  });

  it('chains funnel into code as funnel/prev', () => {
    const r = execNotebookCell({ type: 'code', content: 'return funnel.length;' }, { funnelIn: 'hello' });
    expect(r.isError).toBe(false);
    expect(r.lastPlain).toBe('5');
    expect(r.display).toContain('funnel in');
  });

  it('renders math cell', () => {
    const r = execNotebookCell({ type: 'math', content: '\\alpha + \\beta' });
    expect(r.isError).toBe(false);
    expect(r.display).toContain('α');
  });

  it('counts markdown lines without QuantumPrefixes', () => {
    const r = execNotebookCell({ type: 'markdown', content: 'a\nb\nc' });
    expect(r.display).toContain('3 lines');
  });
});
