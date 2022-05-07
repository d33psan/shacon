import './index.css';

import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Route } from 'react-router-dom';

import App from './components/App';
import { Home } from './components/Home';
import { TopBar } from './components/TopBar/TopBar';
import { Modal } from 'semantic-ui-react';

const Debug = lazy(() => import('./components/Debug/Debug'));


class ShaCon extends React.Component {
  public state = {
    user: undefined as undefined,
    isSubscriber: false,
    isCustomer: false,
    streamPath: undefined as string | undefined,
    beta: false,
    isCustomDomain: false,
  };

  render() {
    return (
      <React.StrictMode>
        {this.state.isCustomDomain && (
          <Modal inverted basic open>
          </Modal>
        )}
        <BrowserRouter>
          <Route
            path="/"
            exact
            render={(props) => {
              if (props.location?.hash) {
                return (
                  <App
                    isSubscriber={this.state.isSubscriber}
                    isCustomer={this.state.isCustomer}
                    streamPath={this.state.streamPath}
                    beta={this.state.beta}
                  />
                );
              }
              return (
                <React.Fragment>
                  <TopBar
                    isSubscriber={this.state.isSubscriber}
                    isCustomer={this.state.isCustomer}
                    hideNewRoom
                  />
                  <Home />
                </React.Fragment>
              );
            }}
          />
          <Route
            path="/r/:vanity"
            exact
            render={(props) => {
              return (
                <App
                  isSubscriber={this.state.isSubscriber}
                  isCustomer={this.state.isCustomer}
                  vanity={props.match.params.vanity}
                  streamPath={this.state.streamPath}
                  beta={this.state.beta}
                />
              );
            }}
          />
          <Route path="/debug">
            <TopBar
              isSubscriber={this.state.isSubscriber}
              isCustomer={this.state.isCustomer}
            />
            <Suspense fallback={null}>
              <Debug />
            </Suspense>
          </Route>
        </BrowserRouter>
      </React.StrictMode>
    );
  }
}
ReactDOM.render(<ShaCon />, document.getElementById('root'));
