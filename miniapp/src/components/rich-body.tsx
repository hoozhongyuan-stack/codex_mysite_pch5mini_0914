import {View, Text, Image, Video, ScrollView} from '@tarojs/components';
import {image} from '../lib/api';
function Node({node,onFullscreen}: {node:any;onFullscreen:(full:boolean)=>void}) {
  if(node.type==='text')return <Text selectable className={(node.marks||[]).map((mark:string)=>'rich-'+mark).join(' ')}>{node.text}</Text>;
  if(node.type==='image')return <Image className="body-image" src={image(node.mediaId)} mode="widthFix" ariaLabel={node.alt}/>;
  if(node.type==='video')return <Video className="body-video" src={image(node.mediaId)} controls onFullscreenChange={event=>onFullscreen(Boolean(event.detail.fullScreen))}/>;
  if(node.type==='hardBreak')return <Text>{'\n'}</Text>;
  if(node.type==='horizontalRule')return <View className="rich-rule"/>;
  if(node.type==='table')return <ScrollView scrollX className="rich-table-scroll" ariaLabel="表格，可左右滑动查看">
    <View className="rich-node rich-table">{(node.children||[]).map((child:any,index:number)=><Node key={index} node={child} onFullscreen={onFullscreen}/>)}</View>
  </ScrollView>;
  return <View className={'rich-node rich-'+node.type+(node.type==='heading'?' rich-h'+node.level:'')}>
    {node.type==='listItem'&&<Text className="rich-bullet">• </Text>}
    {(node.children||[]).map((child:any,index:number)=><Node key={index} node={child} onFullscreen={onFullscreen}/>)}
  </View>;
}
export default function RichBody({nodes,onFullscreen}: {nodes:any[];onFullscreen:(full:boolean)=>void}) {
  return <View className="rich-body">{nodes.map((node,index)=><Node key={index} node={node} onFullscreen={onFullscreen}/>)}</View>;
}
