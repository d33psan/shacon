import React from 'react';
import { serverPath } from '../../utils';
import { Icon, Button, Dropdown } from 'semantic-ui-react';

export class NewRoomButton extends React.Component<{
  size?: string;
  openNewTab?: boolean;
}> {
  createRoom = async () => {
    const response = await window.fetch(serverPath + '/createRoom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    const { name } = data;
    if (this.props.openNewTab) {
      window.open('/#' + name);
    } else {
      window.location.assign('/#' + name);
    }
  };
  render() {
    return (
      <Button
        color="grey"
        size={this.props.size as any}
        icon
        labelPosition="left"
        onClick={this.createRoom}
        className="toolButton"
        fluid
      >
        Create New Room
      </Button>
    );
  }
}


export class TopBar extends React.Component<{
  hideNewRoom?: boolean;
  hideSignin?: boolean;
  hideMyRooms?: boolean;
  isSubscriber: boolean;
  isCustomer: boolean;
  roomTitle?: string;
  roomDescription?: string;
  roomTitleColor?: string;
}> {
  render() {
    return (
      <React.Fragment>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            padding: '1em',
            paddingLeft: '44.25%',
            paddingBottom: '0px',
          }}
        >
          {this.props.roomTitle || this.props.roomDescription ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                marginRight: 10,
                marginLeft: 10,
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  color: this.props.roomTitleColor || 'white',
                  fontWeight: 'bold',
                  letterSpacing: 1,
                }}
              >
                {this.props.roomTitle?.toUpperCase()}
              </div>
              <div style={{ marginTop: 4, color: 'rgb(255 255 255 / 63%)' }}>
                {this.props.roomDescription}
              </div>
            </div>
          ) : (
            <React.Fragment>
              <a href="/" style={{ display: 'flex' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      textTransform: 'uppercase',
                      fontWeight: 500,
                      color: 'rgb(255,157,164)',
                      fontSize: '50px',
                      lineHeight: '50px',
                    }}
                  >
                    Sha
                  </div>
                  <div
                    style={{
                      textTransform: 'uppercase',
                      fontWeight: 500,
                      color: 'rgb(252,195,142)',
                      fontSize: '50px',
                      lineHeight: '50px',
                      marginLeft: 'auto',
                    }}
                  >
                    Con
                  </div>
                </div>
              </a>
            </React.Fragment>
          )}
          <div
            className="mobileStack"
            style={{
              display: 'flex',
              marginLeft: 'auto',
              gap: '4px',
            }}
          >
            {!this.props.hideNewRoom && (
              <NewRoomButton openNewTab />
            )}
          </div>
        </div>
      </React.Fragment>
    );
  }
}
