import { Component, ErrorInfo, ReactNode } from 'react';
import { logAppError } from '../lib/errorLogging';

export class AppErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true}}
  componentDidCatch(error:Error,info:ErrorInfo){void logAppError(error,'react-render',{componentStack:info.componentStack})}
  render(){
    if(this.state.failed)return <main className="fatal-error"><section className="panel"><h1>Something went wrong</h1><p>Please reload the page and try again. If the problem continues, contact SecureTrack support.</p><button className="primary" onClick={()=>location.reload()}>Reload SecureTrack</button></section></main>;
    return this.props.children;
  }
}
