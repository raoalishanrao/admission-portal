import ProcessingFeeChallan, {
  mapApiChallanToData,
} from '@/components/processing-fee/ProcessingFeeChallan'
import type { ProcessingFeePrintResponse } from '@/lib/api/types'

type Props = {
  data: ProcessingFeePrintResponse
}

export function ProcessingFeeChallanSheet({ data }: Props) {
  return <ProcessingFeeChallan data={mapApiChallanToData(data.challan)} />
}
