const { h, render, Component } = preact;
const html = htm.bind(h);

const readNullTerminatedString = (wasm, ptr) => {
  const memoryView = new Uint8Array(wasm.memory.buffer);
  let str = '';
  for (let i = ptr; memoryView[i] !== 0; i++) {
    str += String.fromCharCode(memoryView[i]);
  }
  return str;
};

const allocateString = (wasm, str) => {
  const { memory, wasm_alloc } = wasm;
  const strBuf = new TextEncoder().encode(str);
  const ptr = wasm_alloc(strBuf.length + 1);
  const memoryView = new Uint8Array(memory.buffer);
  for (let i = 0; i < strBuf.length; i++) {
    memoryView[ptr + i] = strBuf[i];
  }
  memoryView[ptr + strBuf.length] = 0;
  return ptr;
};

const allocateOptions = (wasm, options) => {
  const { memory, wasm_alloc } = wasm;
  const ptr = wasm_alloc(8);
  const memoryView = new DataView(memory.buffer);
  memoryView.setUint32(ptr, options.max_size, true);
  memoryView.setUint32(ptr + 4, options.verbose, true);
  return ptr;
}

class App extends Component {
  constructor() {
    super();
    this.state = { 
      input: '',
      results: [],
      loading: true,
      wasm: null,
      ctx: null,
    };
    this.inputRef = preact.createRef();
  }

  getRates = async () => {
    try {
      const stored = JSON.parse(localStorage.getItem('rates.json'));
      if (stored.time_next_update_unix > Date.now() / 1000)
        return stored;
    } catch (e) {}
    console.log('Fetching rates...');
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const rates = await res.json();
    localStorage.setItem('rates.json', JSON.stringify(rates));
  };

  initWasm = async () => {
    const res = await fetch('./libkeisan.wasm');
    const bytes = await res.arrayBuffer();
    const module = await WebAssembly.instantiate(bytes, {
      env: {
        get_time: () => BigInt(Date.now()) * 1000n,
        get_gmt_offset: () => new Date().getTimezoneOffset() * -60,
        log: (ptr) => {
          const str = readNullTerminatedString(this.state.wasm, ptr);
          console.log(str);
        },
        dpow: Math.pow,
        save: (filenamePtr, contentPtr) => {
          const filename = readNullTerminatedString(this.state.wasm, filenamePtr);
          const content = readNullTerminatedString(this.state.wasm, contentPtr);
          localStorage.setItem(filename, content);
          const byteSize = new TextEncoder().encode(content).length;
          return byteSize;
        },
        load: (filenamePtr, contentPtr) => {
          const filename = readNullTerminatedString(this.state.wasm, filenamePtr);
          const content = localStorage.getItem(filename);
          if (content === undefined) {
            return 0;
          }
          const ptr = allocateString(this.state.wasm, content);
          return ptr;
        },
      }
    });

    const wasm = module.instance.exports;
    wasm._initialize();

    const options = {
      max_size: 1,
      verbose: 1,
    };
    const optPtr = allocateOptions(wasm, options);
    const ctx = wasm.ks_init(optPtr);

    this.setState({ wasm, ctx });
  };

  componentDidMount = async () => {
    try {
      await Promise.all([this.getRates(), this.initWasm()]);
      this.setState({ loading: false });
    } catch (error) {
      console.error("Error initializing:", error);
    }
  }

  componentWillUnmount = () => {
    if (this.state.wasm && this.state.ctx) {
      this.state.wasm.ks_free(this.state.ctx);
    }
  }

  handleInput = (event) => {
    const input = event.target.value;
    const lines = input.split('\n');
    const { wasm, ctx } = this.state;

    const results = lines.map(line => {
      if (!line.trim()) return { type: 'result', value: '' };

      const inputPtr = allocateString(wasm, line);
      const res = wasm.ks_evaluate(ctx, inputPtr);
      wasm.wasm_free(inputPtr);

      const memory = new DataView(wasm.memory.buffer);

      if (res) {
        const errPtr = memory.getUint32(ctx + 4, true);
        return { type: 'error', value: readNullTerminatedString(wasm, errPtr) };
      }

      const valuesPtr = memory.getUint32(ctx, true);
      const resultPtr = memory.getUint32(valuesPtr, true);
      const resultValue = readNullTerminatedString(wasm, resultPtr);
      return { type: 'result', value: resultValue };
    });

    this.setState({ input, results });
  };

  render() {
    if (this.state.loading) {
      return html`
        <div class="loading">
            <span>Loading...</span>
            <div class="spinner"></div>
        </div>
      `;
    }

    return html`
      <div id="input-container">
        <textarea
          id="input-area"
          onInput=${this.handleInput}
          value=${this.state.input}
          ref=${this.inputRef}
          spellCheck="false"
          autocorrect="off"
          autocapitalize="off"
        ></textarea>
        <div id="results-area">
          ${this.state.results.map(result => html`
            <div class=${result.type}>
              ${result.value || ' '}
            </div>
          `)}
        </div>
      </div>
    `;
  }
}

render(html`<${App} />`, document.getElementById('app'));
