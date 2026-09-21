import {useState} from 'react';
import {View, Text, Image, Button, Input, Textarea} from '@tarojs/components';
import type {ComponentProps} from 'react';
import {interactionState} from '../lib/interaction.mjs';

type StateProps={disabled?:boolean;loading?:boolean};
/** Text and Image do not support WeChat's native hover-class; use touch state. */
function useTouchFeedback(props:any){
  const [pressed,setPressed]=useState(false);
  const state=interactionState(props,pressed);
  return {...props,className:state.className,
    onClick:state.blocked?undefined:props.onClick,
    onTouchStart:(event:any)=>{if(!state.blocked)setPressed(true);props.onTouchStart?.(event)},
    onTouchMove:(event:any)=>{setPressed(false);props.onTouchMove?.(event)},
    onTouchEnd:(event:any)=>{setPressed(false);props.onTouchEnd?.(event)},
    onTouchCancel:(event:any)=>{setPressed(false);props.onTouchCancel?.(event)},
  };
}
export function ActionText(props:ComponentProps<typeof Text>&StateProps){
  const {disabled,loading,hoverClass,...touch}=useTouchFeedback(props);
  return <Text {...touch}/>;
}
export function ActionImage(props:ComponentProps<typeof Image>&StateProps){
  const {disabled,loading,hoverClass,...touch}=useTouchFeedback(props);
  return <Image {...touch} lazyLoad={props.lazyLoad ?? true}/>;
}
export function ActionView({disabled,loading,...props}:ComponentProps<typeof View>&StateProps){
  const state=interactionState({...props,disabled,loading});
  return <View {...props} className={state.className} role={props.role||'button'}
    hoverClass={state.blocked?'none':'interaction-pressed'} hoverStartTime={0} hoverStayTime={90}
    hoverStopPropagation onClick={state.blocked?undefined:props.onClick}/>;
}
export function ActionButton(props:ComponentProps<typeof Button>){
  const state=interactionState(props);
  return <Button {...props} className={state.className} disabled={state.blocked}
    hoverClass={state.blocked?'none':'interaction-pressed'} hoverStartTime={0} hoverStayTime={90}
    hoverStopPropagation onClick={state.blocked?undefined:props.onClick}/>;
}

function useFieldFeedback(props:any){
  const [focused,setFocused]=useState(false);
  return {...props,className:[props.className,'interaction-field',focused&&!props.disabled?'interaction-focused':'',props.disabled?'interaction-disabled':''].filter(Boolean).join(' '),
    onFocus:(event:any)=>{setFocused(true);props.onFocus?.(event)},
    onBlur:(event:any)=>{setFocused(false);props.onBlur?.(event)},
  };
}
export function ActionInput(props:ComponentProps<typeof Input>){return <Input {...useFieldFeedback(props)}/>;}
export function ActionTextarea(props:ComponentProps<typeof Textarea>){return <Textarea {...useFieldFeedback(props)}/>;}
