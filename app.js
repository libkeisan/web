import Keisan from "./libkeisan.mjs";

import datetime from "./plugins/datetime.mjs";
import unit from "./plugins/unit.mjs";
import percent from "./plugins/percent.mjs";
import currency from "./plugins/currency.mjs";

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

  initWasm = () => {
    const keisan = new Keisan();
    keisan.registerPlugins({ datetime, unit, percent, currency });
    this.setState({ keisan });
  };

  componentDidMount = () => {
    try {
      this.initWasm();
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

      const { values, errors } = keisan.evaluate(input);
      const results = values.map((value, i) => {
        return { type: errors[i] ? "error" : "result", value };
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
