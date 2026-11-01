import { render } from 'preact';
import { App } from './App';
import './styles.css';
import { installAudioUnlock } from './audio/sound';

installAudioUnlock();
render(<App />, document.getElementById('app')!);
