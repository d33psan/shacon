import React from 'react';
import { serverPath } from '../../utils';
import { Icon, Button, Dropdown } from 'semantic-ui-react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import axios from 'axios';

export class NewRoomButton extends React.Component<{
  user: firebase.User | undefined;
  size?: string;
  openNewTab?: boolean;
}> {
  createRoom = async () => {
    const uid = this.props.user?.uid;
    const token = await this.props.user?.getIdToken();
    const response = await window.fetch(serverPath + '/createRoom', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid,
        token,
      }),
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

export class ListRoomsButton extends React.Component<{
  user: firebase.User | undefined;
}> {
  public state = { rooms: [] as PersistentRoom[] };

  componentDidMount() {
    this.refreshRooms();
  }

  refreshRooms = async () => {
    if (this.props.user) {
      const token = await this.props.user.getIdToken();
      const response = await axios.get(
        serverPath + `/listRooms?uid=${this.props.user?.uid}&token=${token}`
      );
      this.setState({ rooms: response.data });
    }
  };

  deleteRoom = async (roomId: string) => {
    if (this.props.user) {
      const token = await this.props.user.getIdToken();
      await axios.delete(
        serverPath +
          `/deleteRoom?uid=${this.props.user?.uid}&token=${token}&roomId=${roomId}`
      );
      this.setState({
        rooms: this.state.rooms.filter((room) => room.roomId !== roomId),
      });
      this.refreshRooms();
    }
  };

  render() {
    return (
      <Dropdown
        style={{ height: '36px' }}
        icon="group"
        labeled
        className="icon"
        button
        text="My Rooms"
        onClick={this.refreshRooms}
        scrolling
      >
        <Dropdown.Menu>
          {this.state.rooms.length === 0 && (
            <Dropdown.Item disabled>You have no permanent rooms.</Dropdown.Item>
          )}
          {this.state.rooms.map((room: any) => {
            return (
              <Dropdown.Item
                link
                href={
                  room.vanity
                    ? '/r/' + room.vanity
                    : '/' + room.roomId.replace('/', '#')
                }
                onClick={() => {
                  if (!room.vanity) {
                    setTimeout(() => window.location.reload(), 100);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {room.vanity
                    ? `/r/${room.vanity}`
                    : room.roomId.replace('/', '#')}
                  <div style={{ marginLeft: 'auto', paddingLeft: '20px' }}>
                    <Button
                      icon
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        e.preventDefault();
                        this.deleteRoom(room.roomId);
                      }}
                      color="red"
                      size="mini"
                    >
                      <Icon name="trash" />
                    </Button>
                  </div>
                </div>
              </Dropdown.Item>
            );
          })}
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

export class TopBar extends React.Component<{
  user?: firebase.User;
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
              <NewRoomButton user={this.props.user} openNewTab />
            )}
          </div>
        </div>
      </React.Fragment>
    );
  }
}
