import React from 'react';
import { Divider, Header, Icon, Step } from 'semantic-ui-react';
import firebase from 'firebase/compat/app';

import { NewRoomButton } from '../TopBar';
import styles from './Home.module.css';

export const Home = ({ user }: { user: firebase.User | undefined }) => {
  return (
    <div>
      <div className={styles.container}>
        <Hero
          action={
            <div
              style={{ marginTop: '8px', width: '160px', paddingTop: '200px' }}
            >
              <NewRoomButton user={user} />
            </div>
          }
        />
      </div>
    </div>
  );
};

const Feature = ({
  icon,
  text,
  title,
}: {
  icon: string;
  text: string;
  title: string;
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flex: '1 1 0px',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px',
        minWidth: '180px',
      }}
    >
      <Icon fitted size="huge" name={icon as any} />
      <h4 className={styles.featureTitle}>{title}</h4>
      <div className={styles.featureText}>{text}</div>
    </div>
  );
};

const Hero = ({
  heroText,
  subText,
  action,
  image,
  color,
}: {
  heroText?: string;
  subText?: string;
  action?: React.ReactNode;
  image?: string;
  color?: string;
}) => {
  return (
    <div className={`${styles.hero} ${color === 'green' ? styles.green : ''}`}>
      <div className={styles.heroInner}>
        <div style={{ padding: '30px', flex: '1 1 0' }}>
          <div className={styles.heroText}>{heroText}</div>
          <div className={styles.subText}>{subText}</div>
          {action}
        </div>
        <div
          style={{
            flex: '1 1 0',
          }}
        ></div>
      </div>
    </div>
  );
};
