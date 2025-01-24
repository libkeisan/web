import init, { Keisan } from "./libkeisan.js";

const { h, render, Component } = preact;
const html = htm.bind(h);

class App extends Component {
  constructor() {
    super();
    this.state = {
      input: "",
      results: [],
      loading: true,
      keisan: null,
    };
    this.inputRef = preact.createRef();
    this.throttleTimeout = null;
  }

  initWasm = async () => {
    await init({
      module_or_path: new URL("libkeisan_bg.wasm", import.meta.url),
    });
    const keisan = new Keisan();
    keisan.setLogLevel("debug");

    const plugins = [
      "./plugins/datetime.js",
      "./plugins/unit.js",
      "./plugins/percent.js",
      "./plugins/currency.js",
    ];
    await Promise.all(
      plugins.map(async (p) => {
        const res = await fetch(p);
        const content = await res.text();
        keisan.addPlugin(p, content);
      }),
    );

    this.setState({ keisan });
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
    if (this.state.keisan) {
      this.state.keisan.free();
    }
  };

  handleInput = (event) => {
    const input = event.target.value;
    this.setState({ input });

    if (this.throttleTimeout) {
      clearTimeout(this.throttleTimeout);
    }

    this.throttleTimeout = setTimeout(() => {
      const { keisan } = this.state;

      const results = keisan.multiEval(input).map((res) => {
        const { output, success } = res;
        const ret = { type: success ? "result" : "error", value: output };
        res.free();
        return ret;
      });

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
