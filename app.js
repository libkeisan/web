import module from "./libkeisan.mjs";

import datetime from "./plugins/datetime.mjs";
import unit from "./plugins/unit.mjs";
import percent from "./plugins/percent.mjs";

const { h, render, Component } = preact;
const html = htm.bind(h);

class Store {
  constructor() {
    this.store = {};
    this.storeId = 0;
  }

  set(value) {
    if (value === undefined) return;
    this.store[this.storeId] = value;
    return this.storeId++;
  }

  get(id) {
    return this.store[id];
  }

  del(id) {
    delete this.store[id];
  }

  dup(id) {
    const value = this.store[id];
    return this.set(value);
  }

  print() {
    console.log(this.store);
  }
}

globalThis.plugins = {
  datetime,
  unit,
  percent,
};

globalThis.store = new Store();

globalThis.keisan = {
  log: console.log,
};

class App extends Component {
  constructor() {
    super();
    this.state = {
      input: "",
      results: [],
      loading: true,
      wasm: null,
      ctx: null,
    };
    this.inputRef = preact.createRef();
    this.throttleTimeout = null;
  }

  initWasm = async () => {
    const wasm = await module();
    const ctx = wasm._api_new();
    this.setState({ wasm, ctx });
  };

  componentDidMount = async () => {
    try {
      await this.initWasm();
      this.setState({ loading: false });
    } catch (error) {
      console.error("Error initializing:", error);
    }
  };

  componentWillUnmount = () => {
    if (this.throttleTimeout) clearTimeout(this.throttleTimeout);
    if (this.state.wasm) {
      this.state.wasm._api_free(this.state.ctx);
    }
  };

  parseContext = () => {
    const { wasm, ctx } = this.state;

    const count = wasm.getValue(ctx, "i32");
    const valuesPtr = wasm.getValue(ctx + 4, "i32");
    const errorsPtr = wasm.getValue(ctx + 8, "i32");

    const values = [];
    for (let i = 0; i < count; i++) {
      const valuePtr = wasm.getValue(valuesPtr + i * 4, "i32");
      const value = wasm.UTF8ToString(valuePtr);
      values.push(value);
    }

    const errors = [];
    for (let i = 0; i < count; i++) {
      const error = wasm.getValue(errorsPtr + i, "i8");
      errors.push(Boolean(error));
    }

    return { count, values, errors };
  };

  processLine = (line) => {
    if (!line.trim()) return { type: "result", value: "" };

    const { wasm, ctx } = this.state;

    const cstr = wasm.stringToNewUTF8(line);
    wasm._api_evaluate(ctx, cstr);
    wasm._free(cstr);

    const { count, values, errors } = this.parseContext(ctx);
    if (count === 0) return { type: "result", value: "" };
    if (errors[0]) return { type: "error", value: values[0] };
    return { type: "result", value: values[0] };
  };

  handleInput = (event) => {
    const input = event.target.value;
    this.setState({ input });

    if (this.throttleTimeout) {
      clearTimeout(this.throttleTimeout);
    }

    this.throttleTimeout = setTimeout(() => {
      const lines = input.split("\n");
      const results = lines.map(this.processLine);
      this.setState({ results });
    }, 100);
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
          spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
        ></textarea>
        <div id="results-area">
          ${this.state.results.map(
            (result) => html`
              <div class=${result.type}>${result.value || " "}</div>
            `,
          )}
        </div>
      </div>
    `;
  }
}

render(html`<${App} />`, document.getElementById("app"));
